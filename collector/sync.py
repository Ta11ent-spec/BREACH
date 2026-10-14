"""Authenticated, account-bound uploads with durable receipts and retry scheduling."""
import email.utils
import json
import random
import time
import urllib.error
import urllib.parse
import urllib.request

from auth import AuthError


class SyncError(Exception):
    def __init__(self, status=0, retry_after=0):
        self.status = status
        self.retry_after = retry_after
        super().__init__('Upload service unavailable' if not status else f'Upload request failed ({status})')


def api_base(value):
    url = urllib.parse.urlparse(value)
    if (url.scheme != 'https' and not (url.scheme == 'http' and url.hostname in ('localhost', '127.0.0.1', '::1'))) or not url.hostname or url.username or url.password or url.query or url.fragment or url.path not in ('', '/'):
        raise ValueError('Use an HTTPS server address, or HTTP on this PC only.')
    return value.rstrip('/')


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def request(base, path, token, payload=None):
    data = payload if isinstance(payload, bytes) else json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(api_base(base) + '/api' + path, data=data, headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', 'Accept': 'application/json'})
    try:
        with urllib.request.build_opener(NoRedirect()).open(req, timeout=25) as response:
            raw = response.read(65537)
            if len(raw) > 65536: raise SyncError()
            result = json.loads(raw)
            if not isinstance(result, dict): raise SyncError()
            return result
    except urllib.error.HTTPError as exc:
        delay = 0
        header = exc.headers.get('Retry-After', '')
        try: delay = max(0, float(header))
        except ValueError:
            try: delay = max(0, email.utils.parsedate_to_datetime(header).timestamp() - time.time())
            except (ValueError, TypeError, OverflowError): pass
        raise SyncError(exc.code, min(delay, 3600)) from None
    except (urllib.error.URLError, TimeoutError, OSError, ValueError):
        raise SyncError() from None


def prepare(store):
    store.db.execute('''CREATE TABLE IF NOT EXISTS sync_queue(
        message_id TEXT PRIMARY KEY REFERENCES queue(message_id), workspace_id TEXT NOT NULL,
        server TEXT NOT NULL, state TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
        next_attempt REAL NOT NULL DEFAULT 0, detail TEXT NOT NULL DEFAULT '',
        acknowledged_at REAL, outcome TEXT)''')
    store.db.commit()


def states(store):
    prepare(store)
    return {r['message_id']: dict(r) for r in store.db.execute('SELECT * FROM sync_queue')}


def retry_blocked(store):
    prepare(store)
    with store.db:
        store.db.execute("UPDATE sync_queue SET state='pending',next_attempt=0 WHERE state IN ('blocked','retry')")


def run(store, auth, base, stop, notify, send=request, now=time.time, jitter=random.uniform):
    prepare(store); base = api_base(base)
    account = send(base, '/account', auth.token())
    owner = account.get('workspaceId')
    if account.get('authenticated') is not True or not isinstance(owner, str) or len(owner) != 64 or any(c not in '0123456789abcdef' for c in owner):
        raise SyncError()
    # Bind once. Signing into a different account cannot silently move pending uploads.
    with store.db:
        store.db.execute("INSERT OR IGNORE INTO sync_queue(message_id,workspace_id,server,state) SELECT message_id,?,?,'pending' FROM queue", (owner, base))
    rows = store.db.execute('''SELECT q.message_id,q.match_id,q.envelope,s.attempts FROM queue q JOIN sync_queue s USING(message_id)
        WHERE s.workspace_id=? AND s.server=? AND s.state IN ('pending','retry') AND s.next_attempt<=? ORDER BY q.created_at LIMIT 20''', (owner, base, now())).fetchall()
    uploaded = 0
    for row in rows:
        if stop.is_set(): break
        try:
            result = send(base, '/collector/matches', auth.token(), bytes(row['envelope']))
            if result.get('acknowledged') is not True or result.get('workspaceId') != owner or result.get('messageId') != row['message_id'] or result.get('matchId') != row['match_id'] or result.get('status') not in ('uploaded', 'duplicate', 'existing_preserved'):
                raise SyncError()
            with store.db:
                store.db.execute("UPDATE sync_queue SET state='uploaded',detail='Acknowledged by website',acknowledged_at=?,outcome=? WHERE message_id=?", (now(), result['status'], row['message_id']))
            uploaded += 1
            notify('Website acknowledged a match. Local replay and JSON retained.')
        except SyncError as exc:
            transient = exc.status in (0, 408, 425, 429) or exc.status >= 500
            attempt = row['attempts'] + 1
            delay = max(exc.retry_after, min(300, 5 * 2 ** min(attempt, 6)) + jitter(0, 5))
            detail = 'Waiting to retry' if transient else ('Sign in or re-enable this collector on the website' if exc.status in (401, 403) else 'Upload needs review; original data retained')
            with store.db:
                store.db.execute('UPDATE sync_queue SET state=?,attempts=?,next_attempt=?,detail=? WHERE message_id=?', ('retry' if transient else 'blocked', attempt, now() + delay, detail, row['message_id']))
            notify(detail)
            # One offline request is enough; avoid hammering a down or rate-limited API.
            if transient or exc.status in (401, 403): break
    other = store.db.execute('SELECT COUNT(*) FROM sync_queue WHERE workspace_id<>? OR server<>?', (owner, base)).fetchone()[0]
    if other: notify(f'{other} queue records belong to a different account or server and were not uploaded.')
    return uploaded
