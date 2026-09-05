---
allowed-tools:
  - Bash
  - Read
  - Glob
  - Grep
  - Write
  - Edit
user-invocable: true
argument-hint: "<path to APK, XAPK, JAR, AAR, DEX, or ARSC file>"
---

# /decompile

Decompile an Android binary file and perform initial triage analysis.

## Steps

### 1. Get target file

Parse `$ARGUMENTS` to determine the target file path. If no argument is provided, ask the user to specify a file.

Validate the file exists and determine its type by extension:
- `.apk` / `.xapk` / `.apks` / `.aab` → Android application package
- `.jar` / `.aar` → Java/Android library
- `.dex` → Dalvik bytecode
- `.so` → Native shared library (use IDA/Ghidra, not jadx)

### 2. Check and install dependencies

Run the dependency check script for the current platform:

```bash
# Linux / macOS
bash scripts/check-deps.sh
# Windows
powershell -ExecutionPolicy Bypass -File scripts/check-deps.ps1
```

Parse output for `INSTALL_REQUIRED:<dep>` lines. If any required dependency is missing, install it:

```bash
bash scripts/install-dep.sh <dep>
# or on Windows:
powershell -ExecutionPolicy Bypass -File scripts/install-dep.ps1 <dep>
```

Do not proceed until all required dependencies (Java 17+, jadx) pass.

### 3. Decompile

Select the decompilation engine based on target type and situation. Read `references/engine-selection.md` for the decision tree.

| Situation | Engine | Reason |
|---|---|---|
| Standard APK/JAR/AAR | jadx | Best default, handles most cases |
| jadx produces broken code | fernflower | Different decompilation backend |
| Heavily obfuscated | `both` | Cross-reference between engines |
| XAPK | jadx (per inner APK) | Auto-extracts and decompiles each APK |
| Need code-only analysis (skip resources) | jadx `--no-res` | Faster output without resource files |

Run the decompile script:

```bash
# Linux / macOS
bash scripts/decompile.sh <target> -o <output-dir> [--deobf] [--engine jadx|fernflower|both]

# Windows
powershell -ExecutionPolicy Bypass -File scripts/decompile.ps1 <target> -o <output-dir> [-Deobf] [-Engine jadx|fernflower|both]
```

### 4. Analyze structure

After decompilation, perform initial triage:

1. Read `AndroidManifest.xml` — identify:
   - Package name, min/target SDK
   - Launcher activity
   - Declared services, receivers, providers
   - Custom permissions and protection levels
   - Exported components

2. Survey package structure under `sources/` — identify:
   - Architecture pattern (MVP/MVVM/Clean Architecture)
   - Major package groups and their roles
   - Third-party libraries and SDKs
   - Obfuscation indicators (a/b/c single-letter packages)

3. Quick grep for security-relevant patterns:
   - Hardcoded URLs and API keys
   - Crypto usage (Cipher, SecretKey, MessageDigest)
   - Network libraries (Retrofit, OkHttp, Volley)
   - JNI native method declarations

### 5. Offer next steps

Present the user with analysis options based on what was found:

- **Trace call flows**: Follow execution from entry points to API layer
- **Extract APIs**: Document all HTTP endpoints with parameters
- **Analyze specific classes**: Deep-dive into particular components
- **Re-decompile with Fernflower**: If jadx output has gaps
- **JNI/Native analysis**: If native libraries were found
- **Protection assessment**: Grade protection level (A0-A7)
- **Run topic playbook**: If the triage suggests a specific topic match

Ask the user which direction to proceed before continuing analysis.
