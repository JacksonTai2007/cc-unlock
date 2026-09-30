"""HTTP/UI contract smoke tests; the service sees synthetic temporary history only."""
from __future__ import annotations

import http.client
import json
import shutil
import subprocess
import sys
import tempfile
import threading
import unittest
from html.parser import HTMLParser
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
EDITOR_ROOT = PROJECT_ROOT / "cc-unlock-codex" / "chat-editor"
sys.path.insert(0, str(EDITOR_ROOT))

import app
from editor_core import Editor
from fixtures import create_demo, THREAD_ID


class AssetReferences(HTMLParser):
    def __init__(self):
        super().__init__()
        self.assets = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "script" and attrs.get("src"):
            self.assets.append(attrs["src"])
        if tag == "link" and attrs.get("rel") == "stylesheet":
            self.assets.append(attrs.get("href", ""))


class EditorAssetsTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="cc-unlock-editor-http-")
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.home = self.root / "synthetic-home"
        create_demo(self.home)
        self.backups = self.root / "never-created-backups"
        self.editor = Editor(self.home, self.backups, demo=True)
        self.locks = self.home / "thread-writer-locks"
        (self.locks / "nested").mkdir(parents=True)
        (self.locks / "live.lock").write_bytes(b"SYNTHETIC LIVE OWNER\r\n")
        (self.locks / ".coordination.lock").write_bytes(b"SYNTHETIC COORDINATION\n")
        (self.locks / "nested" / "owner.lock").write_bytes(b"SYNTHETIC NESTED OWNER\n")
        self.lock_bytes = self.snapshot(self.locks)
        self.server = app.make_server(self.editor, port=0)
        self.worker = threading.Thread(target=self.server.serve_forever,
                                       kwargs={"poll_interval": 0.01}, daemon=True)
        self.worker.start()
        self.addCleanup(self.close_server)

    def close_server(self):
        self.server.shutdown()
        self.worker.join(timeout=5)
        self.server.server_close()

    @staticmethod
    def snapshot(root):
        return {str(path.relative_to(root)): path.read_bytes()
                for path in root.rglob("*") if path.is_file()}

    def request(self, method, path, data=None, authenticated=True, extra_headers=None):
        connection = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=5)
        headers = {"Host": f"127.0.0.1:{self.server.server_port}"}
        if authenticated:
            headers["X-Editor-Token"] = self.server.editor_token
        if extra_headers:
            headers.update(extra_headers)
        body = None
        if data is not None:
            headers["Content-Type"] = "application/json"
            body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        try:
            connection.request(method, path, body=body, headers=headers)
            response = connection.getresponse()
            content = response.read()
            response_headers = {key.lower(): value for key, value in response.getheaders()}
            if "application/json" in response_headers.get("content-type", ""):
                content = json.loads(content)
            return response.status, content, response_headers
        finally:
            connection.close()

    def detail(self):
        status, detail, _ = self.request("GET", "/api/thread?id=" + THREAD_ID)
        self.assertEqual(status, 200, detail)
        return detail

    def edit_payload(self, action, text):
        detail = self.detail()
        turn, message = detail["turns"][0], detail["turns"][0]["messages"][0]
        return {"action": action, "thread_id": THREAD_ID, "revision": detail["revision"],
                "turn_id": turn["id"], "message_key": message["message_key"],
                "force_ref": message["force_ref"], "text": text}

    def test_html_injects_token_and_loads_only_shipped_external_assets(self):
        status, body, headers = self.request("GET", "/", authenticated=False)
        self.assertEqual(status, 200)
        self.assertIn("text/html", headers["content-type"])
        html = body.decode("utf-8")
        self.assertNotIn("__TOKEN__", html)
        self.assertIn(self.server.editor_token, html)
        parser = AssetReferences()
        parser.feed(html)
        self.assertTrue(parser.assets)
        self.assertIn("editor.css", [item.lstrip("./") for item in parser.assets])
        self.assertIn("editor.js", [item.lstrip("./") for item in parser.assets])
        for asset in parser.assets:
            with self.subTest(asset=asset):
                self.assertIn(asset.lstrip("./"), app.UI_ASSETS)
                code, content, _ = self.request("GET", "/" + asset.lstrip("./"), authenticated=False)
                self.assertEqual(code, 200)
                self.assertTrue(content)

    def test_asset_allowlist_content_types_and_cache_headers(self):
        self.assertEqual(set(app.UI_ASSETS), {"editor.css", "editor-api.js", "editor-view.js",
                                             "editor-dialog.js", "editor-actions.js", "editor.js"})
        for name, content_type in app.UI_ASSETS.items():
            with self.subTest(asset=name):
                status, body, headers = self.request("GET", "/" + name, authenticated=False)
                self.assertEqual(status, 200)
                self.assertEqual(body, (EDITOR_ROOT / name).read_bytes())
                self.assertEqual(headers["content-type"], content_type)
                self.assertEqual(headers["cache-control"], "no-store")
                self.assertEqual(headers["x-content-type-options"], "nosniff")

    def test_internal_files_and_traversal_are_not_served(self):
        for path in ("/app.py", "/editor_core.py", "/writer_lock_cleanup.py", "/.editor-runtime.json",
                     "/../app.py", "/%2e%2e/app.py", "/editor.css/../app.py",
                     "/%2Feditor.css", "/editor.css%00", "/editor.css.bak", "/folder/editor.css"):
            with self.subTest(path=path):
                status, _, _ = self.request("GET", path, authenticated=False)
                self.assertEqual(status, 404)

    def test_host_and_origin_reject_cross_site_html_assets_and_api(self):
        for path in ("/", "/editor.css", "/api/status"):
            for header in ({"Host": "attacker.invalid"}, {"Origin": "https://attacker.invalid"}):
                with self.subTest(path=path, header=header):
                    status, _, _ = self.request("GET", path, extra_headers=header)
                    self.assertEqual(status, 403)

    def test_api_token_required_for_reads_and_mutations(self):
        before = self.snapshot(self.home)
        for method, path, data in (("GET", "/api/status", None), ("GET", "/api/thread?id=" + THREAD_ID, None),
                                   ("POST", "/api/preview", {"action": "rename"}),
                                   ("POST", "/api/apply", {"plan_id": "not-valid"})):
            for headers in ({}, {"X-Editor-Token": "wrong-token"}):
                with self.subTest(method=method, path=path, headers=headers):
                    # Auth is rejected before body parsing. Do not race an upload
                    # against the server closing an unauthorized Windows socket.
                    status, _, _ = self.request(method, path, authenticated=False, extra_headers=headers)
                    self.assertEqual(status, 403)
                    self.assertEqual(self.snapshot(self.home), before)

    def save_and_reopen(self, action, text):
        payload = self.edit_payload(action, text)
        before = self.snapshot(self.home)
        status, plan, _ = self.request("POST", "/api/preview", payload)
        self.assertEqual(status, 200, plan)
        self.assertEqual(self.snapshot(self.home), before)
        status, result, _ = self.request("POST", "/api/apply", {"plan_id": plan["plan_id"], "confirm": THREAD_ID})
        self.assertEqual(status, 200, result)
        self.assertTrue(result["ok"])
        self.assertFalse(result["backup_created"])
        self.assertEqual(result["writer_lock_policy"]["action"], "preserved")
        self.assertNotIn("writer_lock_cleanup", result)
        self.assertEqual(self.snapshot(self.locks), self.lock_bytes)
        self.assertFalse(self.backups.exists())
        self.assertEqual(self.detail()["turns"][0]["messages"][0]["text"], text)
        reopened = Editor(self.home, self.backups, demo=True)
        self.assertEqual(reopened.get_thread(THREAD_ID)["turns"][0]["messages"][0]["text"], text)
        for path in reopened._rollouts(reopened._row(THREAD_ID)):
            self.assertIn(json.dumps(text, ensure_ascii=False).encode("utf-8"), path.read_bytes())

    def test_ordinary_preview_apply_persists_body_without_backups_or_lock_deletion(self):
        self.save_and_reopen("edit_message", "HTTP_NORMAL_SAVE_正文\n<em>仅为文字</em>")

    def test_force_preview_apply_persists_body_without_backups_or_lock_deletion(self):
        self.save_and_reopen("force_edit_message", "HTTP_FORCE_SAVE_正文\n<em>仅为文字</em>")

    def test_stale_preview_cannot_overwrite_latest_save(self):
        status, old_plan, _ = self.request("POST", "/api/preview", self.edit_payload("force_edit_message", "STALE_DRAFT"))
        self.assertEqual(status, 200, old_plan)
        self.save_and_reopen("edit_message", "LATEST_HTTP_SAVE")
        before = self.snapshot(self.home)
        status, result, _ = self.request("POST", "/api/apply", {"plan_id": old_plan["plan_id"], "confirm": THREAD_ID})
        self.assertEqual(status, 400, result)
        self.assertEqual(self.snapshot(self.home), before)
        self.assertEqual(self.snapshot(self.locks), self.lock_bytes)

    def test_save_plan_requires_exact_thread_and_cannot_be_replayed(self):
        status, plan, _ = self.request("POST", "/api/preview", self.edit_payload("edit_message", "REPLAY_GUARD"))
        self.assertEqual(status, 200, plan)
        before = self.snapshot(self.home)
        status, _, _ = self.request("POST", "/api/apply", {"plan_id": plan["plan_id"], "confirm": "wrong-thread"})
        self.assertEqual(status, 400)
        self.assertEqual(self.snapshot(self.home), before)
        status, result, _ = self.request("POST", "/api/apply", {"plan_id": plan["plan_id"], "confirm": THREAD_ID})
        self.assertEqual(status, 200, result)
        after = self.snapshot(self.home)
        status, _, _ = self.request("POST", "/api/apply", {"plan_id": plan["plan_id"], "confirm": THREAD_ID})
        self.assertEqual(status, 400)
        self.assertEqual(self.snapshot(self.home), after)

    def test_shipped_javascript_parses(self):
        node = shutil.which("node")
        if not node:
            self.fail("NOT_RUN: node is needed for JavaScript syntax validation")
        for name in app.UI_ASSETS:
            if name.endswith(".js"):
                with self.subTest(asset=name):
                    result = subprocess.run([node, "--check", str(EDITOR_ROOT / name)],
                                            capture_output=True, text=True, timeout=10)
                    self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main(verbosity=2)
