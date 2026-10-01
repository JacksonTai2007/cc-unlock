// Read-only Windows lock status probe. Does not delete files or touch other processes.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const MAX_FILES = 512;
const MAX_OUTPUT_BYTES = 1024 * 1024;
const TIMEOUT_MS = 12000;
// Paths go through JSON stdin only, never PowerShell code or a shell command.
const PROBE_COMMAND = String.raw`
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$inputText = [Console]::In.ReadToEnd()
$paths = ConvertFrom-Json -InputObject $inputText
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class CCUnlockLockState {
  [StructLayout(LayoutKind.Sequential)]
  private struct UNICODE_STRING {
    public ushort Length;
    public ushort MaximumLength;
    public IntPtr Buffer;
  }
  [StructLayout(LayoutKind.Sequential)]
  private struct OBJECT_ATTRIBUTES {
    public uint Length;
    public IntPtr RootDirectory;
    public IntPtr ObjectName;
    public uint Attributes;
    public IntPtr SecurityDescriptor;
    public IntPtr SecurityQualityOfService;
  }
  [StructLayout(LayoutKind.Sequential)]
  private struct IO_STATUS_BLOCK {
    public IntPtr Status;
    public UIntPtr Information;
  }
  [DllImport("ntdll.dll", ExactSpelling = true)]
  private static extern uint NtOpenFile(out IntPtr handle, uint access,
    ref OBJECT_ATTRIBUTES attributes, out IO_STATUS_BLOCK ioStatus,
    uint share, uint options);
  [DllImport("ntdll.dll", ExactSpelling = true)]
  private static extern uint NtClose(IntPtr handle);
  public static uint Probe(string file) {
    string nativePath = file.StartsWith(@"\\")
      ? @"\??\UNC\" + file.Substring(2) : @"\??\" + file;
    int bytes = checked(nativePath.Length * 2);
    if (bytes > 65532) return 0xc0000106; // STATUS_NAME_TOO_LONG
    IntPtr buffer = IntPtr.Zero, name = IntPtr.Zero, handle = IntPtr.Zero;
    try {
      buffer = Marshal.StringToHGlobalUni(nativePath);
      UNICODE_STRING text = new UNICODE_STRING();
      text.Length = (ushort)bytes;
      text.MaximumLength = (ushort)(bytes + 2);
      text.Buffer = buffer;
      name = Marshal.AllocHGlobal(Marshal.SizeOf(typeof(UNICODE_STRING)));
      Marshal.StructureToPtr(text, name, false);
      OBJECT_ATTRIBUTES attributes = new OBJECT_ATTRIBUTES();
      attributes.Length = (uint)Marshal.SizeOf(typeof(OBJECT_ATTRIBUTES));
      attributes.ObjectName = name;
      attributes.Attributes = 0x40; // OBJ_CASE_INSENSITIVE
      IO_STATUS_BLOCK io;
      // FILE_READ_ATTRIBUTES | SYNCHRONIZE, full sharing. Open the reparse
      // point itself, not a target, with no delete/write access requested.
      uint status = NtOpenFile(out handle, 0x00100080, ref attributes,
        out io, 7, 0x00200020);
      if (status < 0x80000000 && handle != IntPtr.Zero && handle != new IntPtr(-1)) {
        NtClose(handle); // Only our own successful NtOpenFile handle.
        handle = IntPtr.Zero;
      }
      return status;
    } finally {
      if (name != IntPtr.Zero) Marshal.FreeHGlobal(name);
      if (buffer != IntPtr.Zero) Marshal.FreeHGlobal(buffer);
    }
  }
}
"@ -ErrorAction Stop | Out-Null
$results = @(foreach ($file in $paths) {
  $status = [CCUnlockLockState]::Probe([string]$file)
  [pscustomobject]@{ file = [string]$file; ntstatus = ('0x{0:x8}' -f $status) }
})
ConvertTo-Json -InputObject $results -Compress -Depth 3
`;

function inside(root, file) {
  const relative = path.relative(root, file);
  return !path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`);
}
function assertDirectoryChain(dir) {
  const absolute = path.resolve(dir), drive = path.parse(absolute).root;
  let current = drive;
  for (const part of absolute.slice(drive.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    const info = fs.lstatSync(current);
    if (info.isSymbolicLink() || !info.isDirectory()) {
      throw Object.assign(new Error('writer lock parent is not a regular directory'), { code: 'CC_LOCK_SCOPE' });
    }
  }
}
function statusName(ntstatus) {
  switch (ntstatus) {
    case '0x00000000': return 'accessible';
    case '0xc0000056': return 'delete-pending';
    case '0xc0000022': return 'access-denied';
    case '0xc0000043': return 'sharing-violation';
    case '0xc0000034':
    case '0xc000003a':
    case '0xc000000f': return 'not-found';
    default: return 'other';
  }
}
function probeLockDeleteState(files, opts = {}) {
  const result = { supported: process.platform === 'win32', results: [], failures: [] };
  const failure = (file, stage, err) => result.failures.push({ file, stage,
    code: err && err.code || 'CC_LOCK_PROBE', error: String(err && err.message || err) });
  if (!result.supported) {
    failure(null, 'unsupported', Object.assign(new Error('Native writer lock probe is Windows-only'), { code: 'ENOTSUP' }));
    return result;
  }
  const expected = path.resolve(os.homedir(), '.codex', 'thread-writer-locks');
  let root;
  try {
    root = path.resolve(opts.root === undefined ? expected : opts.root);
    if (path.relative(expected, root) !== '') throw Object.assign(new Error('Probe root must be the current user writer lock directory'), { code: 'CC_LOCK_SCOPE' });
    if (!Array.isArray(files) || files.length > MAX_FILES) throw Object.assign(new Error(`Probe requires at most ${MAX_FILES} explicit file paths`), { code: 'CC_LOCK_INPUT' });
    if (!files.length) return result;
    assertDirectoryChain(root);
    const realRoot = fs.realpathSync(root), realCodex = fs.realpathSync(path.dirname(root));
    if (path.relative(path.join(realCodex, 'thread-writer-locks'), realRoot)) throw Object.assign(new Error('Probe root resolves outside expected lock directory'), { code: 'CC_LOCK_SCOPE' });
    const names = [], seen = new Set();
    for (const file of files) {
      if (typeof file !== 'string' || !file || file.includes('\0') || Buffer.byteLength(file, 'utf16le') > 65480) throw Object.assign(new Error('Invalid explicit lock file path'), { code: 'CC_LOCK_INPUT' });
      const absolute = path.resolve(file), parent = path.dirname(absolute);
      if (absolute === root || !inside(root, absolute)) throw Object.assign(new Error('Probe file is outside current user writer lock directory'), { code: 'CC_LOCK_SCOPE' });
      // Never lstat the lock itself: that is precisely the legacy libuv failure
      // being diagnosed. Check each parent instead; native open is nonrecursive.
      assertDirectoryChain(parent);
      if (!inside(realRoot, fs.realpathSync(parent))) throw Object.assign(new Error('Probe parent resolves outside writer lock directory'), { code: 'CC_LOCK_SCOPE' });
      const identity = absolute.toLowerCase();
      if (!seen.has(identity)) { seen.add(identity); names.push(absolute); }
    }
    const systemRoot = process.env.SystemRoot;
    if (!systemRoot || !path.isAbsolute(systemRoot)) throw Object.assign(new Error('SystemRoot is unavailable for native probe'), { code: 'CC_LOCK_PROBE_UNAVAILABLE' });
    const powershell = path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    let stdout;
    try {
      stdout = execFileSync(powershell, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', PROBE_COMMAND], {
        input: JSON.stringify(names), encoding: 'utf8', windowsHide: true,
        timeout: TIMEOUT_MS, maxBuffer: MAX_OUTPUT_BYTES,
      });
    } catch (err) { failure(null, 'native-probe', err); return result; }
    try {
      const records = JSON.parse(String(stdout).replace(/^\uFEFF/, '').trim());
      if (!Array.isArray(records) || records.length !== names.length) throw new Error('Native probe returned an incomplete result');
      const byName = new Map(names.map(file => [file.toLowerCase(), file]));
      const parsed = [];
      for (const record of records) {
        if (!record || typeof record.file !== 'string' || !/^0x[0-9a-f]{8}$/i.test(record.ntstatus)) throw new Error('Native probe returned an invalid result');
        const identity = path.resolve(record.file).toLowerCase(), file = byName.get(identity);
        if (!file) throw new Error('Native probe returned an unexpected or repeated path');
        byName.delete(identity);
        const ntstatus = record.ntstatus.toLowerCase();
        parsed.push({ file, ntstatus, status: statusName(ntstatus) });
      }
      if (byName.size) throw new Error('Native probe omitted requested paths');
      result.results = parsed;
    } catch (err) { failure(null, 'parse-native-result', err); }
  } catch (err) { failure(null, 'validate-input', err); }
  return result;
}
module.exports = { probeLockDeleteState };
