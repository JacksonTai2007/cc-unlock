"""Regression tests for lock-preserving saves; all history is synthetic."""
from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

EDITOR_ROOT = Path(__file__).resolve().parents[1] / "cc-unlock-codex" / "chat-editor"
sys.path.insert(0, str(EDITOR_ROOT))

from editor_core import Editor, EditorError
from fixtures import create_demo, THREAD_ID


class SavePolicyTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="cc-unlock-save-policy-")
        self.addCleanup(self.tmp.cleanup)
        root = Path(self.tmp.name)
        self.home = root / "synthetic-home"
        self.backups = root / "backups"
        create_demo(self.home)
        self.editor = Editor(self.home, self.backups, demo=True)
        self.locks = self.home / "thread-writer-locks"
        (self.locks / "nested").mkdir(parents=True)
        (self.locks / "live.lock").write_bytes(b"writer-is-live\r\n")
        (self.locks / ".coordination.lock").write_bytes(b"coordination\x00")
        (self.locks / "nested" / "stale.lock").write_bytes(b"stale-owner\n")
        self.original_locks = self.lock_bytes()

    def lock_bytes(self):
        return {str(p.relative_to(self.locks)): p.read_bytes()
                for p in self.locks.rglob("*") if p.is_file()}

    def home_bytes(self):
        return {str(p.relative_to(self.home)): p.read_bytes()
                for p in self.home.rglob("*") if p.is_file()}

    def prepare(self, action, text, editor=None):
        editor = editor or self.editor
        detail = editor.get_thread(THREAD_ID)
        turn = detail["turns"][0]
        message = turn["messages"][0]
        return editor.preview({
            "action": action, "thread_id": THREAD_ID,
            "turn_id": turn["id"], "message_key": message["message_key"],
            "force_ref": message["force_ref"], "text": text,
            "revision": detail["revision"],
        })

    def assert_preserved(self, result):
        self.assertTrue(result["ok"])
        self.assertFalse(result["backup_created"])
        self.assertFalse(self.backups.exists())
        self.assertEqual(result["writer_lock_policy"], {
            "action": "preserved",
            "reason": "message-save-does-not-remove-writer-locks",
        })
        self.assertNotIn("writer_lock_cleanup", result)
        self.assertNotIn("cleanup_warning", result)
        self.assertEqual(self.lock_bytes(), self.original_locks)
        self.assertTrue((self.locks / "nested").is_dir())

    def assert_saved(self, text):
        reopened = Editor(self.home, self.backups, demo=True)
        self.assertEqual(reopened.get_thread(THREAD_ID)["turns"][0]["messages"][0]["text"], text)
        rollouts = reopened._rollouts(reopened._row(THREAD_ID))
        self.assertTrue(rollouts)
        for path in rollouts:
            self.assertIn(text.encode("utf-8"), path.read_bytes())

    def test_regular_save_commits_text_and_preserves_all_writer_files(self):
        text = "NORMAL_SAVE_保持原始锁"
        plan = self.prepare("edit_message", text)
        self.assert_preserved(self.editor.apply(plan["plan_id"], THREAD_ID))
        self.assert_saved(text)

    def test_force_save_commits_text_and_never_calls_lock_cleanup(self):
        text = "FORCE_SAVE_保持原始锁"
        plan = self.prepare("force_edit_message", text)
        with patch("writer_lock_cleanup.cleanup_writer_locks", side_effect=AssertionError("cleanup must not run")) as cleanup:
            result = self.editor.apply(plan["plan_id"], THREAD_ID)
        cleanup.assert_not_called()
        self.assert_preserved(result)
        self.assert_saved(text)

    def test_force_preview_is_read_only_and_does_not_promise_lock_deletion(self):
        before = self.home_bytes()
        plan = self.prepare("force_edit_message", "READ_ONLY_PREVIEW")
        self.assertEqual(self.home_bytes(), before)
        self.assertIn("保存不删除 writer 锁", plan["warning"])
        self.assertNotIn("将清空", plan["warning"])

    def test_stale_save_rejected_and_preserves_latest_history_and_locks(self):
        stale = self.prepare("force_edit_message", "STALE_DO_NOT_SAVE")
        competing = Editor(self.home, self.backups, demo=True)
        latest = self.prepare("edit_message", "LATEST_SAVE", competing)
        competing.apply(latest["plan_id"], THREAD_ID)
        before = self.home_bytes()
        with self.assertRaisesRegex(EditorError, "记录已变化"):
            self.editor.apply(stale["plan_id"], THREAD_ID)
        self.assertEqual(self.home_bytes(), before)
        self.assertEqual(self.lock_bytes(), self.original_locks)
        self.assert_saved("LATEST_SAVE")

    def test_failed_save_keeps_original_history_and_locks_without_disk_backup(self):
        plan = self.prepare("force_edit_message", "WRITE_FAILURE")
        before = self.home_bytes()
        with patch.object(self.editor, "_mutate", side_effect=RuntimeError("simulated write error")):
            with self.assertRaisesRegex(RuntimeError, "simulated write error"):
                self.editor.apply(plan["plan_id"], THREAD_ID)
        self.assertEqual(self.home_bytes(), before)
        self.assertEqual(self.lock_bytes(), self.original_locks)
        self.assertFalse(self.backups.exists())


if __name__ == "__main__":
    unittest.main(verbosity=2)
