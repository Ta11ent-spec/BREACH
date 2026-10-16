"""Replay discovery and isolated parser execution; originals are read-only."""
import hashlib
import json
import os
import subprocess
import tempfile
import time
from pathlib import Path

from adapter import convert, resource


def fingerprint(paths):
    return hashlib.sha256(json.dumps([(p.name, p.stat().st_size, p.stat().st_mtime_ns) for p in sorted(paths)]).encode()).hexdigest()


def replay_files(folder):
    return sorted(p for p in folder.glob('*.rec') if p.is_file() and not p.is_symlink())


def discover(root):
    root = Path(root)
    if not root.is_dir():
        raise ValueError('Select an existing MatchReplay folder')
    folders = [root, *(p for p in root.iterdir() if p.is_dir() and not p.is_symlink())]
    found = [(p, replay_files(p)) for p in folders]
    return sorted(((p, files) for p, files in found if files), key=lambda item: max(p.stat().st_mtime_ns for p in item[1]), reverse=True)


def installed_locations():
    """Read launcher/game install records; never scan whole drives or change registry."""
    if os.name != 'nt': return [], []
    import winreg
    steam, games = [], []
    def values(hive, key, names):
        try:
            with winreg.OpenKey(hive, key) as handle:
                for name in names:
                    try:
                        value, _ = winreg.QueryValueEx(handle, name)
                        if isinstance(value, str) and value.strip(): yield Path(os.path.expandvars(value.strip().strip('"')))
                    except OSError: pass
        except OSError: pass
    for hive in (winreg.HKEY_CURRENT_USER, winreg.HKEY_LOCAL_MACHINE):
        for key in (r'Software\Valve\Steam', r'Software\WOW6432Node\Valve\Steam'):
            steam.extend(values(hive, key, ('SteamPath', 'InstallPath')))
        for base in (r'Software\Microsoft\Windows\CurrentVersion\Uninstall', r'Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall'):
            try:
                with winreg.OpenKey(hive, base) as parent:
                    for i in range(winreg.QueryInfoKey(parent)[0]):
                        try:
                            key=base+'\\'+winreg.EnumKey(parent, i)
                            with winreg.OpenKey(hive, key) as app:
                                name, _=winreg.QueryValueEx(app, 'DisplayName')
                            if 'rainbow' in str(name).lower() and 'siege' in str(name).lower():
                                games.extend(values(hive, key, ('InstallLocation',)))
                        except OSError: pass
            except OSError: pass
        for base in (r'Software\Ubisoft\Launcher\Installs', r'Software\WOW6432Node\Ubisoft\Launcher\Installs'):
            try:
                with winreg.OpenKey(hive, base) as parent:
                    for i in range(winreg.QueryInfoKey(parent)[0]):
                        try: games.extend(values(hive, base+'\\'+winreg.EnumKey(parent, i), ('InstallDir',)))
                        except OSError: pass
            except OSError: pass
    return steam, games


def suggested_roots():
    import re
    steam, games = installed_locations()
    for env, fallback in [('PROGRAMFILES(X86)', 'C:/Program Files (x86)'), ('PROGRAMFILES', 'C:/Program Files')]:
        base=Path(os.environ.get(env, fallback))
        steam.append(base/'Steam')
        games.append(base/"Ubisoft/Ubisoft Game Launcher/games/Tom Clancy's Rainbow Six Siege")
    libraries=list(steam)
    for launcher in steam:
        for config in (launcher/'steamapps/libraryfolders.vdf', launcher/'config/libraryfolders.vdf'):
            try:
                text=config.read_text(encoding='utf-8', errors='replace')
                libraries.extend(Path(v.replace('\\\\', '\\')) for v in re.findall(r'"path"\s+"([^"]+)"', text))
            except OSError: pass
    for library in dict.fromkeys(libraries):
        apps=library/'steamapps'
        games.append(apps/"common/Tom Clancy's Rainbow Six Siege")
        try:
            for manifest in apps.glob('appmanifest_*.acf'):
                try:
                    text=manifest.read_text(encoding='utf-8', errors='replace')
                    name=re.search(r'"name"\s+"([^"]+)"', text, re.I)
                    directory=re.search(r'"installdir"\s+"([^"]+)"', text, re.I)
                    if name and directory and 'rainbow' in name[1].lower() and 'siege' in name[1].lower():
                        games.append(apps/'common'/directory[1])
                except OSError: pass
        except OSError: pass
    roots={}
    for game in games:
        candidate=game if game.name.lower()=='matchreplay' else game/'MatchReplay'
        try:
            if candidate.is_dir(): roots.setdefault(os.path.normcase(str(candidate.resolve())), str(candidate.resolve()))
        except OSError: pass
    return list(roots.values())


def parser_manifest():
    return json.loads(resource('parser-manifest.json').read_text(encoding='utf-8'))


def verify_parser(parser, expected_hash):
    if not parser.is_file():
        raise ValueError('Bundled parser is missing. Reinstall the collector.')
    with parser.open('rb') as stream:
        digest = hashlib.file_digest(stream, 'sha256').hexdigest()
    if digest != expected_hash:
        raise ValueError('Parser checksum does not match this build. Reinstall the collector.')


def parse_one(parser, source, dest, stop, timeout=180):
    # Pipes redirected to a file avoid deadlock on a verbose parser.
    with dest.with_suffix('.log').open('w+b') as output:
        proc = subprocess.Popen([str(parser), str(source), '-o', str(dest)], stdout=output, stderr=subprocess.STDOUT,
                                shell=False, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        started = time.monotonic()
        try:
            while proc.poll() is None:
                if stop.wait(.15):
                    raise InterruptedError('Scan paused; retry will start this match safely')
                if time.monotonic() - started > timeout:
                    raise TimeoutError('Parser timed out; retry or check replay compatibility')
            if proc.returncode:
                output.seek(0, 2); size = output.tell(); output.seek(max(0, size - 1200))
                detail = output.read().decode('utf-8', errors='replace')
                if 'panic:' in detail:
                    raise ValueError('Replay parser crashed; this recording may be incomplete or incompatible. Original files are safe. Export diagnostics and retain this replay folder for investigation. ' + detail[-1200:])
                raise ValueError('Parser failed: ' + detail)
        finally:
            if proc.poll() is None:
                proc.kill(); proc.wait(timeout=10)
    if not dest.exists() or dest.stat().st_size > 32 * 1024 * 1024:
        raise ValueError('Parser produced missing or oversized JSON')
    return json.loads(dest.read_text(encoding='utf-8-sig'))


def process(store, folder, files, parser, version, stop, min_age=120):
    signature = fingerprint(files)
    prior = store.job(folder)
    if prior and prior['signature'] == signature and prior['state'] in ('queued', 'duplicate'):
        return 'cached'
    if any(p.stat().st_size == 0 or time.time() - p.stat().st_mtime < min_age for p in files):
        store.record(folder, signature, 'held', 'Replay files are still changing; waiting for 120 seconds of quiet')
        return 'held'
    store.record(folder, signature, 'parsing', 'Reading replay files')
    try:
        with tempfile.TemporaryDirectory(prefix='breach-parse-') as tmp:
            raw, hashes = [], {}
            for i, src in enumerate(files):
                if stop.is_set():
                    raise InterruptedError('Paused before parsing the next round')
                with src.open('rb') as stream:
                    digest = hashlib.file_digest(stream, 'sha256').hexdigest()
                value = parse_one(parser, src, Path(tmp) / f'{i}.json', stop)
                index = value.get('roundNumber')
                if index in hashes:
                    raise ValueError('Duplicate round index in replay folder')
                hashes[index] = digest; raw.append(value)
            current = replay_files(folder)
            if current != files or fingerprint(current) != signature:
                raise ValueError('Replay folder changed during parsing; retry after it settles')
            envelope = convert(raw, hashes, store.get('installationId'), version)
            if envelope['payload']['match']['completion'] != 'complete':
                store.record(folder, signature, 'held', envelope['payload']['issues'][0]['message'])
                return 'held'
            if stop.is_set():
                raise InterruptedError('Paused before queue commit')
            message, added = store.enqueue(envelope)
            state = 'queued' if added else 'duplicate'
            store.record(folder, signature, state, f'Ready for JSON export · {message}')
            return state
    except InterruptedError as exc:
        store.record(folder, signature, 'interrupted', str(exc))
        return 'interrupted'
    except Exception as exc:
        store.record(folder, signature, 'failed', str(exc)[:2000])
        return 'failed'


def scan(store, root, parser, version, stop, notify=lambda text: None, retry=False, limit=20, min_age=120):
    count = 0
    for folder, files in discover(root):
        if stop.is_set() or count >= limit:
            break
        prior = store.job(folder)
        if prior and prior['signature'] == fingerprint(files) and prior['state'] in ('queued', 'duplicate', 'failed', 'held') and not retry:
            # Young files need another automatic quiet check; other unchanged holds do not.
            if not (prior['state'] == 'held' and 'still changing' in prior['detail']):
                continue
        if prior and prior['signature'] == fingerprint(files) and prior['state'] in ('queued', 'duplicate'):
            continue
        count += 1
        notify(f'Reading {folder.name}')
        state = process(store, folder, files, parser, version, stop, min_age)
        notify(f'{folder.name}: {state}')
    return count
