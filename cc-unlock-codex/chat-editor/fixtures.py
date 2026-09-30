"""Deterministic, entirely synthetic Codex history for demos and regression tests."""
from __future__ import annotations

import json
from contextlib import contextmanager
from pathlib import Path
import sqlite3

THREAD_ID = "11111111-1111-4111-8111-111111111111"
OTHER_ID = "22222222-2222-4222-8222-222222222222"
TURN_IDS = [f"aaaaaaaa-aaaa-4aaa-8aaa-{n:012d}" for n in range(1, 4)]
OTHER_TURN_IDS = [f"bbbbbbbb-bbbb-4bbb-8bbb-{n:012d}" for n in range(1, 3)]


@contextmanager
def _database(path: Path):
    conn = sqlite3.connect(path)
    try:
        with conn:
            yield conn
    finally:
        conn.close()


def _json(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def _records(thread_id: str, turns: list[str]) -> list[dict]:
    records = [{"timestamp": "2026-09-16T01:00:00.000Z", "type": "session_meta",
                "payload": {"id": thread_id, "timestamp": "2026-09-16T01:00:00.000Z",
                            "cwd": "C:\\SyntheticDemo", "originator": "codex_cli_rs",
                            "cli_version": "0.0.0-demo", "source": "cli",
                            "model_provider": "openai"}}]
    for number, turn_id in enumerate(turns, 1):
        timestamp = f"2026-09-16T01:0{number}:00.000Z"
        prefix = "DEMO" if thread_id == THREAD_ID else "OTHER"
        user_text = f"{prefix}_USER_TURN_{number} 这是合成演示消息 {number}"
        answer = f"{prefix}_ASSISTANT_TURN_{number} 合成回复，不含真实对话。"
        def add(kind: str, payload: dict) -> None:
            records.append({"timestamp": timestamp, "type": kind, "payload": payload})
        add("event_msg", {"type": "task_started", "turn_id": turn_id,
                          "model_context_window": 200000})
        add("turn_context", {"turn_id": turn_id, "cwd": "C:\\SyntheticDemo",
                             "approval_policy": "never", "model": "demo"})
        add("response_item", {"type": "message", "role": "user",
                              "content": [{"type": "input_text", "text": user_text}]})
        add("response_item", {"type": "message", "role": "assistant", "phase": "final_answer",
                              "content": [{"type": "output_text", "text": answer}]})
        add("event_msg", {"type": "task_complete", "turn_id": turn_id,
                          "last_agent_message": answer})
    return records


def create_demo(home: Path) -> dict:
    """Create fixtures only in an empty directory; never overwrite any history."""
    home = Path(home).resolve()
    home.mkdir(parents=True, exist_ok=True)
    if any(home.iterdir()):
        raise ValueError(f"Demo directory must be empty: {home}")
    (home / ".codex-editor-demo").write_text("synthetic-fixtures-v1\n", encoding="utf-8")
    sessions = home / "sessions" / "2026" / "09" / "16"
    sessions.mkdir(parents=True)
    paths = {
        THREAD_ID: sessions / f"rollout-2026-09-16T01-00-00-{THREAD_ID}.jsonl",
        OTHER_ID: sessions / f"rollout-2026-09-16T02-00-00-{OTHER_ID}.jsonl",
    }
    turn_sets = {THREAD_ID: TURN_IDS, OTHER_ID: OTHER_TURN_IDS}
    for thread_id, turns in turn_sets.items():
        paths[thread_id].write_text("".join(_json(row) + "\n" for row in _records(thread_id, turns)),
                                   encoding="utf-8", newline="")
    # Same logical session, different physical writer files: deletion must include both.
    duplicate = sessions / f"rollout-2026-09-16T01-00-00-{THREAD_ID}_33333333-3333-4333-8333-333333333333.jsonl"
    duplicate.write_bytes(paths[THREAD_ID].read_bytes())

    with _database(home / "state_5.sqlite") as conn:
        conn.execute("""CREATE TABLE threads (
            id TEXT PRIMARY KEY, title TEXT NOT NULL, name TEXT, rollout_path TEXT NOT NULL,
            created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, archived INTEGER NOT NULL DEFAULT 0,
            first_user_message TEXT NOT NULL DEFAULT '', preview TEXT NOT NULL DEFAULT '',
            cwd TEXT NOT NULL DEFAULT '', recency_at INTEGER NOT NULL DEFAULT 0,
            recency_at_ms INTEGER NOT NULL DEFAULT 0)""")
        for i, thread_id in enumerate(turn_sets):
            title = "演示对话：可以安全练习删除" if thread_id == THREAD_ID else "另一段对话：应保持不变"
            prefix = "DEMO" if thread_id == THREAD_ID else "OTHER"
            conn.execute("INSERT INTO threads VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                         (thread_id, title, title, str(paths[thread_id]), 1789520400 + i,
                          1789520700 + i, 0, f"{prefix}_USER_TURN_1", f"{prefix}_ASSISTANT_TURN_1",
                          "C:\\SyntheticDemo", 1789520700 + i, 1789520700000 + i))

    with _database(home / "thread_history_1.sqlite") as conn:
        conn.executescript("""
        CREATE TABLE thread_turns (
            thread_id TEXT NOT NULL, turn_id TEXT NOT NULL, rollout_ordinal INTEGER NOT NULL,
            status TEXT NOT NULL, error_json TEXT, started_at INTEGER, completed_at INTEGER,
            duration_ms INTEGER, first_user_item_id TEXT, final_agent_item_id TEXT,
            rollout_byte_offset INTEGER, rollout_end_ordinal INTEGER, rollout_end_byte_offset INTEGER,
            PRIMARY KEY(thread_id,turn_id));
        CREATE TABLE thread_items (
            thread_id TEXT NOT NULL, turn_id TEXT NOT NULL, item_id TEXT NOT NULL,
            rollout_ordinal INTEGER NOT NULL, created_at_ms INTEGER NOT NULL, item_json TEXT NOT NULL,
            item_type TEXT NOT NULL DEFAULT '', updated_at_ordinal INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY(thread_id,turn_id,item_id));
        CREATE TABLE thread_history_projection_state (
            thread_id TEXT PRIMARY KEY, next_rollout_byte_offset INTEGER NOT NULL,
            next_rollout_ordinal INTEGER NOT NULL);
        """)
        for thread_id, turns in turn_sets.items():
            lines = paths[thread_id].read_bytes().splitlines(keepends=True)
            prefix = "DEMO" if thread_id == THREAD_ID else "OTHER"
            for n, turn_id in enumerate(turns, 1):
                ordinal = 1 + (n - 1) * 5
                user_id, agent_id = f"user-{n}", f"agent-{n}"
                conn.execute("INSERT INTO thread_turns VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                             (thread_id, turn_id, ordinal, "completed", None, 1789520400000+n,
                              1789520400100+n, 100, user_id, agent_id,
                              sum(map(len, lines[:ordinal])), ordinal+4,
                              sum(map(len, lines[:ordinal+5]))))
                items = [
                    {"type": "userMessage", "id": user_id, "clientId": None,
                     "content": [{"type": "text", "text": f"{prefix}_USER_TURN_{n} 这是合成演示消息 {n}"}]},
                    {"type": "agentMessage", "id": agent_id,
                     "text": f"{prefix}_ASSISTANT_TURN_{n} 合成回复，不含真实对话。", "phase": "final_answer",
                     "memoryCitation": None, "delivery": None, "questions": None},
                ]
                for offset, item in enumerate(items, 2):
                    conn.execute("INSERT INTO thread_items VALUES (?,?,?,?,?,?,?,?)",
                                 (thread_id, turn_id, item["id"], ordinal+offset,
                                  1789520400000+n, _json(item), item["type"], ordinal+offset))
            conn.execute("INSERT INTO thread_history_projection_state VALUES (?,?,?)",
                         (thread_id, paths[thread_id].stat().st_size, len(lines)))

    (home / "sqlite").mkdir()
    with _database(home / "sqlite" / "codex-dev.db") as conn:
        conn.executescript("""
        CREATE TABLE local_thread_catalog (
            host_id TEXT NOT NULL, thread_id TEXT NOT NULL, display_title TEXT NOT NULL,
            source_created_at REAL NOT NULL, source_updated_at REAL NOT NULL,
            cwd TEXT, source_kind TEXT NOT NULL, source_detail TEXT, model_provider TEXT,
            git_branch TEXT, observation_sequence INTEGER NOT NULL,
            missing_candidate INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY(host_id,thread_id));
        CREATE TABLE thread_timeline_ledger (
            host_id TEXT NOT NULL, thread_id TEXT NOT NULL, sequence INTEGER NOT NULL,
            record_id TEXT NOT NULL, payload_json TEXT NOT NULL,
            PRIMARY KEY(host_id,thread_id,sequence), UNIQUE(host_id,thread_id,record_id)) WITHOUT ROWID;
        """)
        for thread_id, turns in turn_sets.items():
            conn.execute("INSERT INTO local_thread_catalog VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                         ("local", thread_id, "演示标题" if thread_id == THREAD_ID else "另一段标题",
                          1789520400, 1789520700, "C:\\SyntheticDemo", "cli", None, "openai", None, 1, 0))
            for n, turn_id in enumerate(turns, 1):
                conn.execute("INSERT INTO thread_timeline_ledger VALUES (?,?,?,?,?)",
                             ("local", thread_id, n, f"record-{n}",
                              _json({"turnId": turn_id, "text": f"{'DEMO' if thread_id == THREAD_ID else 'OTHER'}_USER_TURN_{n}"})))
    (home / "session_index.jsonl").write_text(
        "".join(_json({"id": thread_id, "thread_name": "演示对话" if thread_id == THREAD_ID else "另一段对话",
                       "updated_at": "2026-09-16T01:05:00.000Z"}) + "\n" for thread_id in turn_sets),
        encoding="utf-8", newline="")
    return {"thread_id": THREAD_ID, "other_id": OTHER_ID, "turn_ids": list(TURN_IDS),
            "other_turn_ids": list(OTHER_TURN_IDS), "rollout_path": str(paths[THREAD_ID]),
            "duplicate_path": str(duplicate), "other_path": str(paths[OTHER_ID])}


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("home", type=Path, help="Empty destination directory for synthetic demo")
    args = parser.parse_args()
    print(json.dumps(create_demo(args.home), ensure_ascii=False, indent=2))
