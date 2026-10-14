"""Crash-safe local queue. Export is not an upload acknowledgement."""
import hashlib
import json
import sqlite3
import uuid
from pathlib import Path

from adapter import encode, utc_now, validate


class Store:
    def __init__(self, path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(self.path, timeout=30)
        self.db.row_factory = sqlite3.Row
        self.db.execute('PRAGMA journal_mode=WAL')
        self.db.execute('PRAGMA synchronous=FULL')
        self.db.executescript('''
            CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS jobs(
                folder TEXT PRIMARY KEY, signature TEXT NOT NULL, state TEXT NOT NULL,
                detail TEXT NOT NULL, updated_at TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0);
            CREATE TABLE IF NOT EXISTS queue(
                message_id TEXT PRIMARY KEY, match_id TEXT NOT NULL UNIQUE,
                source_digest TEXT NOT NULL, envelope BLOB NOT NULL,
                created_at TEXT NOT NULL, exported_at TEXT);
        ''')
        with self.db:
            self.db.execute('INSERT OR IGNORE INTO settings VALUES(?,?)', ('installationId', str(uuid.uuid4())))

    def close(self):
        self.db.close()

    def get(self, key, default=None):
        row = self.db.execute('SELECT value FROM settings WHERE key=?', (key,)).fetchone()
        return row[0] if row else default

    def set(self, key, value):
        with self.db:
            self.db.execute('INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', (key, value))

    def recover(self):
        # Called once while holding the application instance lock, before workers start.
        with self.db:
            self.db.execute("UPDATE jobs SET state='interrupted',detail='Interrupted scan; safe to retry',updated_at=? WHERE state='parsing'", (utc_now(),))

    def job(self, folder):
        row = self.db.execute('SELECT * FROM jobs WHERE folder=?', (str(folder),)).fetchone()
        return dict(row) if row else None

    def record(self, folder, signature, state, detail):
        with self.db:
            self.db.execute('''INSERT INTO jobs VALUES(?,?,?,?,?,?) ON CONFLICT(folder) DO UPDATE SET
                signature=excluded.signature,state=excluded.state,detail=excluded.detail,updated_at=excluded.updated_at,
                attempts=jobs.attempts+excluded.attempts''', (str(folder), signature, state, detail, utc_now(), int(state == 'parsing')))

    def enqueue(self, envelope):
        validate(envelope)
        match_id = envelope['payload']['match']['matchId']
        if envelope['payload']['match']['completion'] != 'complete':
            raise ValueError('Incomplete matches cannot enter the ready queue')
        identity = sorted((r['roundId'], r['sourceSha256']) for r in envelope['payload']['rounds'])
        digest = hashlib.sha256(json.dumps(identity).encode()).hexdigest()
        with self.db:
            existing = self.db.execute('SELECT * FROM queue WHERE match_id=?', (match_id,)).fetchone()
            if existing:
                if existing['source_digest'] != digest:
                    raise ValueError('Source conflict: this match already has different replay bytes. Existing record retained.')
                return existing['message_id'], False
            self.db.execute('INSERT INTO queue VALUES(?,?,?,?,?,NULL)', (envelope['messageId'], match_id, digest, encode(envelope), utc_now()))
        return envelope['messageId'], True

    def jobs(self):
        return [dict(r) for r in self.db.execute('SELECT * FROM jobs ORDER BY updated_at DESC,folder LIMIT 500')]

    def queued(self):
        return [dict(r) for r in self.db.execute('SELECT message_id,match_id,created_at,exported_at FROM queue ORDER BY created_at DESC')]

    def export(self, message_id, target):
        row = self.db.execute('SELECT envelope FROM queue WHERE message_id=?', (message_id,)).fetchone()
        if not row:
            raise ValueError('Queue item not found')
        target = Path(target)
        if target.suffix.lower() != '.json':
            raise ValueError('Choose a .json destination; replay and database files cannot be export targets')
        # Caller chooses the destination and confirms replacement through the save dialog.
        temp = target.with_name(target.name + '.' + uuid.uuid4().hex + '.tmp')
        try:
            with temp.open('xb') as f:
                f.write(row[0]); f.flush()
                import os
                os.fsync(f.fileno())
            temp.replace(target)
        finally:
            temp.unlink(missing_ok=True)
        with self.db:
            self.db.execute('UPDATE queue SET exported_at=? WHERE message_id=?', (utc_now(), message_id))
