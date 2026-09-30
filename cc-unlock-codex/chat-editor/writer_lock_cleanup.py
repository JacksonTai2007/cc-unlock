"""Remove writer-lock files after a committed ``force_edit_message`` save.

API: ``cleanup_writer_locks(home: Path) -> dict`` accepts the editor's selected
CODEX_HOME. It preserves all directories, never makes backups, and returns
``{ok, removed, failed: [{path, error}], skipped: [{path, reason}]}``. ``removed``
is a count; ``ok`` is false if any entry failed or was skipped for safety. A
missing lock directory is an idempotent success. No symlink/reparse point is
followed or removed. Errors are data, not exceptions that undo the saved text.

Call ONLY after the force-edit mutation commits, outside its rollback handler.
Other mutations and previews must not invoke this function. The caller should
keep the primary save successful and show a warning when cleanup is incomplete.
This is a bounded cleanup pass, not a process lock: a live writer may create a
new lock afterward. Concurrent adversarial directory renames are not supported.
"""
from __future__ import annotations

import os
from pathlib import Path
import stat


_REPARSE_POINT = getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400)


def _is_reparse(info: os.stat_result) -> bool:
    return stat.S_ISLNK(info.st_mode) or bool(
        getattr(info, "st_file_attributes", 0) & _REPARSE_POINT
    )


def cleanup_writer_locks(home: Path) -> dict:
    """Best-effort, file-only cleanup beneath the selected home's lock folder."""
    result = {"ok": True, "removed": 0, "failed": [], "skipped": []}

    def fail(path: Path, error: Exception | str) -> None:
        result["failed"].append({"path": str(path), "error": str(error)})
        result["ok"] = False

    def skip(path: Path, reason: str) -> None:
        result["skipped"].append({"path": str(path), "reason": reason})
        result["ok"] = False

    selected_home = Path(home).absolute()
    try:
        selected_home = selected_home.resolve(strict=True)
        if not selected_home.is_dir():
            raise ValueError("Selected CODEX_HOME is not a directory")
    except (OSError, ValueError, RuntimeError) as error:
        fail(selected_home, error)
        return result

    root = selected_home / "thread-writer-locks"

    def check_directory(directory: Path) -> None:
        # Revalidate every ancestor just before traversal or unlinking. In
        # particular, Windows junctions report as directories, not symlinks.
        relative = directory.relative_to(root)
        cursor = root
        for part in (None, *relative.parts):
            if part is not None:
                cursor /= part
            info = cursor.lstat()
            if _is_reparse(info):
                raise ValueError("Refusing symlink or reparse-point directory")
            if not stat.S_ISDIR(info.st_mode):
                raise ValueError("Expected a real directory")
            resolved = cursor.resolve(strict=True)
            if cursor == root:
                if resolved != root or resolved.parent != selected_home:
                    raise ValueError("Lock directory escapes selected CODEX_HOME")
            elif not resolved.is_relative_to(root):
                raise ValueError("Subdirectory escapes the lock directory")

    try:
        root.lstat()
    except FileNotFoundError:
        return result
    except OSError as error:
        fail(root, error)
        return result
    try:
        check_directory(root)
    except (OSError, ValueError, RuntimeError) as error:
        fail(root, error)
        return result

    pending = [root]
    while pending:
        directory = pending.pop()
        try:
            check_directory(directory)
            with os.scandir(directory) as scan:
                # Determinism makes failure reports and verification repeatable.
                entries = sorted(scan, key=lambda item: item.name)
        except FileNotFoundError:
            # Another writer may already have removed a nested directory.
            continue
        except (OSError, ValueError, RuntimeError) as error:
            fail(directory, error)
            continue

        for entry in entries:
            path = directory / entry.name
            try:
                info = path.lstat()
                if _is_reparse(info):
                    skip(path, "Symlink or reparse point preserved; target not followed")
                    continue
                if stat.S_ISDIR(info.st_mode):
                    pending.append(path)
                    continue
                if not stat.S_ISREG(info.st_mode):
                    skip(path, "Non-regular file preserved")
                    continue
                check_directory(directory)
                if not path.resolve(strict=True).is_relative_to(root):
                    raise ValueError("File escapes the lock directory")
                # Recheck the file itself after ancestor validation; a link is
                # never intentionally passed to unlink, even if it points inward.
                current = path.lstat()
                if _is_reparse(current) or not stat.S_ISREG(current.st_mode):
                    skip(path, "File type changed during cleanup; entry preserved")
                    continue
                path.unlink()
                result["removed"] += 1
            except FileNotFoundError:
                # Concurrent disappearance already satisfies this file's cleanup.
                continue
            except (OSError, ValueError, RuntimeError) as error:
                fail(path, error)
    return result
