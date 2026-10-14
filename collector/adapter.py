"""Versioned replay conversion. No SQL, game writes or network access."""
import hashlib
import json
import re
import sys
import uuid
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker

VERSION = '0.3.0'
MAX_BYTES = 4 * 1024 * 1024
FORMATS = FormatChecker()


@FORMATS.checks('date-time', raises=ValueError)
def valid_utc(value):
    if not isinstance(value, str):
        return True
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z', value):
        return False
    datetime.fromisoformat(value)
    return True


def resource(name):
    base = Path(getattr(sys, '_MEIPASS', Path(__file__).parent))
    return base / 'assets' / name


def schema_path():
    bundled = resource('collector-v1.schema.json')
    return bundled if bundled.exists() else Path(__file__).parents[1] / 'public/contracts/collector-v1.schema.json'


def utc_now():
    return datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')


def uid(*parts):
    # Must match the original importer, including its zero-based round index.
    return hashlib.sha256('|'.join(map(str, parts)).encode()).hexdigest()[:24]


def encode(envelope):
    return json.dumps(envelope, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False).encode('utf-8')


def validate(envelope):
    schema = json.loads(schema_path().read_text(encoding='utf-8'))
    validator = Draft202012Validator(schema, format_checker=FORMATS)
    errors = [f'{list(e.absolute_path)}: {e.message}' for e in validator.iter_errors(envelope)]
    if errors:
        raise ValueError('; '.join(errors[:8]))
    if len(encode(envelope)) > MAX_BYTES:
        raise ValueError('Envelope exceeds the 4 MiB contract limit')
    p = envelope['payload']
    rounds = {r['roundId']: r for r in p['rounds']}
    players = {r['playerId'] for r in p['players']}
    numbers = {r['number'] for r in p['rounds']}
    if len(rounds) != len(p['rounds']) or len(numbers) != len(rounds):
        raise ValueError('Duplicate round ID or number')
    if len(players) != len(p['players']):
        raise ValueError('Duplicate player identity')
    for r in rounds.values():
        if {t['slot'] for t in r['teams']} != {0, 1}:
            raise ValueError('Round must contain distinct team slots')
        outcomes = [t['won'] for t in r['teams']]
        if None not in outcomes and outcomes[0] == outcomes[1]:
            raise ValueError('Contradictory round outcomes')
    pairs = set()
    for a in p['appearances']:
        key = (a['roundId'], a['playerId'])
        if key in pairs or key[0] not in rounds or key[1] not in players:
            raise ValueError('Duplicate or unresolved appearance')
        pairs.add(key)
        s = a['stats']
        if s['headshots'] is not None and s['kills'] is not None and s['headshots'] > s['kills']:
            raise ValueError('Headshots exceed kills')
    ids, sequences = set(), set()
    for e in p['events']:
        key = (e['roundId'], e['sequence'])
        if e['eventId'] in ids or key in sequences or key[0] not in rounds:
            raise ValueError('Duplicate or unresolved event')
        ids.add(e['eventId']); sequences.add(key)
        for actor in ('actorPlayerId', 'targetPlayerId'):
            if e[actor] is not None and (e['roundId'], e[actor]) not in pairs:
                raise ValueError('Event identity must participate in its round')
    if p['match']['completion'] == 'complete':
        if numbers != set(range(1, len(rounds) + 1)) or any(t['won'] is None for r in rounds.values() for t in r['teams']):
            raise ValueError('Complete match requires contiguous rounds and known outcomes')


def completion(raw):
    """Conservative Ranked Bomb rule with per-round score progression evidence."""
    ordered = sorted(raw, key=lambda r: r['roundNumber'])
    if [r['roundNumber'] for r in ordered] != list(range(len(ordered))):
        return False, 'Missing rounds; waiting for a contiguous match'
    previous = [0, 0]
    for index, r in enumerate(ordered):
        if (r.get('matchType') or {}).get('name') != 'Ranked' or (r.get('gamemode') or {}).get('name') != 'Bomb' or r.get('roundsPerMatch') != 6:
            return False, 'Unsupported mode or regulation length; retained for review'
        teams = r['teams']
        if len(teams) != 2 or any(type(t.get('score')) is not int or type(t.get('won')) is not bool for t in teams):
            return False, 'Missing score or round outcome'
        scores = [t['score'] for t in teams]
        wins = [t['won'] for t in teams]
        if sum(wins) != 1 or scores != [previous[i] + int(wins[i]) for i in range(2)]:
            return False, 'Scores do not agree with recorded round outcomes'
        previous = scores
        a, b = sorted(scores, reverse=True)
        ended = (a == 4 and a - b >= 2 and index < 6) or (a == 5 and 6 <= index <= 8)
        if ended:
            return (index == len(ordered) - 1, 'Completed Ranked Bomb match' if index == len(ordered) - 1 else 'Rounds continue after a terminal score')
    return False, 'Final score does not confirm a finished match'


def convert(raw_rounds, source_hashes, installation_id, parser_version, message_id=None):
    if not raw_rounds:
        raise ValueError('No replay rounds supplied')
    for r in raw_rounds:
        if not isinstance(r, dict) or type(r.get('roundNumber')) is not int or r['roundNumber'] < 0:
            raise ValueError('Invalid source round index')
        for key in ('players', 'teams', 'stats', 'matchFeedback'):
            if not isinstance(r.get(key), list) or any(not isinstance(x, dict) for x in r[key]):
                raise ValueError(f'Invalid source {key} array')
    raw = sorted(raw_rounds, key=lambda r: r['roundNumber'])
    first = raw[0]
    match_id = first.get('matchID')
    uuid.UUID(match_id)
    if len({r.get('matchID') for r in raw}) != 1 or len({r['roundNumber'] for r in raw}) != len(raw):
        raise ValueError('Mixed matches or duplicate source rounds')
    if len({str((r.get('map') or {}).get('id')) for r in raw}) != 1:
        raise ValueError('Map identity changes between rounds')
    complete, reason = completion(raw)
    players, rounds, appearances, events, issues = {}, [], [], [], []
    issues.append({'severity': 'info' if complete else 'warning', 'code': 'COMPLETION_CHECK', 'message': reason})
    decimal = lambda v: None if v is None else str(v)
    for r in raw:
        index = r['roundNumber']; rid = uid(match_id, index)
        if index not in source_hashes:
            raise ValueError('Missing original replay SHA-256; a JSON digest is not a substitute')
        rounds.append({'roundId': rid, 'number': index + 1, 'site': r.get('site'), 'sourceSha256': source_hashes[index],
                       'teams': [{'slot': i, 'side': {'Attack': 'ATK', 'Defense': 'DEF'}.get(t.get('role'), 'UNKNOWN'), 'won': t.get('won')} for i, t in enumerate(r['teams'])]})
        name_counts = Counter(p.get('username') for p in r['players'])
        stat_counts = Counter(p.get('username') for p in r['stats'])
        stats = {s.get('username'): s for s in r['stats']}
        identities = {}
        for p in r['players']:
            name, profile = p.get('username'), p.get('profileID') or None
            if not name or (name_counts[name] > 1 and not profile):
                raise ValueError('Player identity cannot be resolved: missing name or duplicate anonymous name')
            pid = profile or uid(match_id, name)
            players[pid] = {'playerId': pid, 'profileId': profile, 'username': name}
            identities.setdefault(name, []).append(pid)
            s = stats.get(name, {}) if name_counts[name] == 1 and stat_counts[name] == 1 else {}
            if not s:
                issues.append({'severity': 'warning', 'code': 'AMBIGUOUS_OR_MISSING_STATS', 'message': f'Round {index + 1}: stats cannot be uniquely linked to {name}; measurements remain null'})
            op = p.get('operator') or {}
            appearances.append({'roundId': rid, 'playerId': pid, 'teamIndex': p.get('teamIndex'), 'operatorId': decimal(op.get('id')), 'operatorName': op.get('name'),
                                'stats': {k: s.get(k) for k in ('kills', 'died', 'assists', 'headshots', 'damageDealt', 'damageTaken')} | {'scoreSnapshot': s.get('score')}})
        for i, e in enumerate(r['matchFeedback']):
            def resolve(name):
                candidates = identities.get(name, [])
                return candidates[0] if len(candidates) == 1 else None
            typ = e.get('type'); typ = typ.get('name') if isinstance(typ, dict) else typ
            events.append({'eventId': uid(rid, i), 'roundId': rid, 'sequence': i, 'type': typ,
                           'actorPlayerId': resolve(e.get('username')), 'targetPlayerId': resolve(e.get('target')),
                           'actorUsername': e.get('username'), 'targetUsername': e.get('target'),
                           'timeRemainingSeconds': e.get('timeInSeconds'), 'headshot': e.get('headshot'), 'weaponId': decimal(e.get('weaponID'))})
            if typ == 'Kill' and e.get('timeInSeconds') == 0:
                issues.append({'severity': 'warning', 'code': 'ZERO_TIME_KILL', 'message': f'Round {index + 1}: kill at 0 seconds; verify against replay'})
    envelope = {'schemaVersion': '1.0.0', 'messageId': message_id or str(uuid.uuid4()),
                'collector': {'installationId': installation_id, 'version': VERSION},
                'source': {'kind': 'pc-replay', 'parserName': 'siege-dissect', 'parserVersion': parser_version, 'normalizerVersion': VERSION, 'gameVersion': first.get('gameVersion'), 'collectedAt': utc_now()},
                'payload': {'match': {'matchId': match_id, 'mapId': decimal((first.get('map') or {}).get('id')), 'mapName': (first.get('map') or {}).get('name'),
                                      'playedAt': first.get('timestamp'), 'recordingProfileId': first.get('recordingProfileID') or None,
                                      'completion': 'complete' if complete else 'incomplete', 'matchType': (first.get('matchType') or {}).get('name'), 'gameMode': (first.get('gamemode') or {}).get('name')},
                            'rounds': rounds, 'players': list(players.values()), 'appearances': appearances, 'events': events, 'issues': issues}}
    validate(envelope)
    return envelope
