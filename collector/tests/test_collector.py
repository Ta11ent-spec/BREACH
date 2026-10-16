import copy
import json
import os
import sys
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from adapter import completion, convert, uid, validate
from engine import process, scan
from store import Store

MATCH = '11111111-1111-4111-8111-111111111111'
PLAYER = '22222222-2222-4222-8222-222222222222'
INSTALL = '33333333-3333-4333-8333-333333333333'


def source():
    scores = [(1, 0), (1, 1), (1, 2), (2, 2), (3, 2), (4, 2)]
    previous = (0, 0); rounds = []
    for i, score in enumerate(scores):
        rounds.append({'matchID': MATCH, 'roundNumber': i, 'roundsPerMatch': 6,
                       'gameVersion': 'TEST', 'timestamp': '2026-10-12T20:00:00Z',
                       'matchType': {'name': 'Ranked'}, 'gamemode': {'name': 'Bomb'},
                       'map': {'id': 2**63, 'name': 'Test'}, 'teams': [
                           {'score': score[k], 'won': score[k] > previous[k], 'role': 'Attack' if k == 0 else 'Defense'} for k in (0, 1)],
                       'players': [{'username': 'One', 'profileID': PLAYER, 'teamIndex': 0, 'operator': {'id': 1, 'name': 'Test'}}],
                       'stats': [{'username': 'One', 'kills': 1, 'headshots': 1, 'died': False, 'score': -1}],
                       'matchFeedback': [{'type': {'name': 'Kill'}, 'username': 'One', 'target': 'Unresolved', 'timeInSeconds': 15}]})
        previous = score
    return rounds


def envelope(raw=None):
    raw = source() if raw is None else raw
    return convert(raw, {r['roundNumber']: str(r['roundNumber']) * 64 for r in raw}, INSTALL, 'test-parser')


class AdapterTests(unittest.TestCase):
    def test_real_contract_ids_nulls_and_large_identifiers(self):
        result = envelope(); validate(result)
        self.assertEqual(result['payload']['rounds'][0]['roundId'], uid(MATCH, 0))
        self.assertEqual(result['payload']['events'][0]['eventId'], uid(uid(MATCH, 0), 0))
        self.assertEqual(result['payload']['match']['mapId'], str(2**63))
        self.assertIsNone(result['payload']['appearances'][0]['stats']['damageDealt'])
        self.assertEqual(result['payload']['appearances'][0]['stats']['scoreSnapshot'], -1)
        self.assertIsNone(result['payload']['events'][0]['targetPlayerId'])

    def test_complete_and_incomplete(self):
        self.assertTrue(completion(source())[0])
        self.assertFalse(completion(source()[:-1])[0])
        self.assertFalse(completion(source()[1:])[0])
        self.assertEqual(envelope(source()[:-1])['payload']['match']['completion'], 'incomplete')

    def test_score_jumps_and_post_terminal_rounds_are_not_complete(self):
        raw = source(); raw[2]['teams'][0]['score'] = 5
        self.assertFalse(completion(raw)[0])
        raw = source(); extra = copy.deepcopy(raw[-1]); extra['roundNumber'] = 6; raw.append(extra)
        self.assertFalse(completion(raw)[0])

    def test_unsupported_mode_is_held(self):
        for mode in ('Custom', 'Unknown', 'DualFront'):
            with self.subTest(mode=mode):
                raw = source(); raw[-1]['matchType']['name'] = mode
                self.assertFalse(completion(raw)[0])

    def test_missing_source_bytes_digest_is_rejected(self):
        with self.assertRaisesRegex(ValueError, 'original replay'):
            convert(source(), {}, INSTALL, 'test')

    def test_mixed_matches_duplicate_rounds_and_bad_types(self):
        for mutation in ('mixed', 'duplicate', 'bool'):
            raw = source()
            if mutation == 'mixed': raw[-1]['matchID'] = INSTALL
            elif mutation == 'duplicate': raw[-1]['roundNumber'] = 0
            else: raw[-1]['roundNumber'] = True
            with self.assertRaises(ValueError): envelope(raw)

    def test_duplicate_names_do_not_claim_event_identity(self):
        raw = source()
        raw[0]['players'].append({'username': 'One', 'profileID': INSTALL, 'teamIndex': 1})
        result = envelope(raw)
        self.assertIsNone(result['payload']['events'][0]['actorPlayerId'])
        self.assertIsNone(result['payload']['appearances'][0]['stats']['kills'])

    def test_duplicate_anonymous_names_rejected(self):
        raw = source(); raw[0]['players'] = [{'username': 'Same'}, {'username': 'Same'}]
        with self.assertRaisesRegex(ValueError, 'identity'): envelope(raw)

    def test_missing_and_duplicate_stats_preserve_null(self):
        raw = source(); raw[0]['stats'] *= 2; raw[1]['stats'] = []
        result = envelope(raw)
        for a in result['payload']['appearances'][:2]: self.assertIsNone(a['stats']['kills'])

    def test_measurements_and_unknown_ownership_are_rejected(self):
        for field, value in [('kills', -1), ('headshots', 2), ('kills', True)]:
            result = envelope(); result['payload']['appearances'][0]['stats'][field] = value
            with self.assertRaises(ValueError): validate(result)
        result = envelope(); result['workspaceId'] = 'untrusted'
        with self.assertRaises(ValueError): validate(result)

    def test_event_must_reference_participant_in_same_round(self):
        result = envelope(); result['payload']['appearances'] = result['payload']['appearances'][1:]
        with self.assertRaisesRegex(ValueError, 'participate'): validate(result)

    def test_bad_timestamp_and_duplicate_events_rejected(self):
        result = envelope(); result['source']['collectedAt'] = '2026-02-30T12:00:00Z'
        with self.assertRaises(ValueError): validate(result)
        result = envelope(); result['payload']['events'].append(result['payload']['events'][0])
        with self.assertRaisesRegex(ValueError, 'Duplicate'): validate(result)


class QueueTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name); self.store = Store(self.root / 'queue.db')
        self.addCleanup(lambda: self.store.close())

    def test_restart_preserves_identity_message_and_payload(self):
        before = self.store.get('installationId'); item = envelope(); message, added = self.store.enqueue(item)
        self.assertTrue(added)
        other = Store(self.store.path)
        try:
            self.assertEqual(other.get('installationId'), before)
            self.assertEqual(other.queued()[0]['message_id'], message)
            message2, added2 = other.enqueue(envelope())
            self.assertFalse(added2); self.assertEqual(message, message2)
        finally: other.close()

    def test_conflicting_source_retains_original(self):
        first = envelope(); self.store.enqueue(first)
        second = envelope(); second['payload']['rounds'][0]['sourceSha256'] = 'a' * 64
        with self.assertRaisesRegex(ValueError, 'conflict'): self.store.enqueue(second)
        self.assertEqual(len(self.store.queued()), 1)
        self.assertEqual(self.store.queued()[0]['message_id'], first['messageId'])

    def test_incomplete_never_queued(self):
        with self.assertRaisesRegex(ValueError, 'Incomplete'): self.store.enqueue(envelope(source()[:-1]))
        self.assertFalse(self.store.queued())

    def test_export_keeps_queue_and_original_message(self):
        item = envelope(); self.store.enqueue(item); target = self.root / 'export.json'
        self.store.export(item['messageId'], target)
        self.assertEqual(json.loads(target.read_text(encoding='utf-8')), item)
        self.assertEqual(len(self.store.queued()), 1)
        self.assertTrue(self.store.queued()[0]['exported_at'])

    def test_recover_interrupted_job(self):
        self.store.record(self.root, 'sig', 'parsing', 'Reading'); self.store.recover()
        self.assertEqual(self.store.job(self.root)['state'], 'interrupted')

    def test_export_cannot_overwrite_replay_or_database(self):
        item = envelope(); self.store.enqueue(item)
        replay = self.root / 'source.rec'; replay.write_bytes(b'original replay')
        for target in (replay, self.store.path):
            with self.assertRaisesRegex(ValueError, '.json destination'):
                self.store.export(item['messageId'], target)
        self.assertEqual(replay.read_bytes(), b'original replay')
        self.assertEqual(len(self.store.queued()), 1)

    def files(self):
        folder = self.root / 'MatchReplay'; folder.mkdir()
        files = []
        for i in range(6):
            p = folder / f'{i}.rec'; p.write_bytes(f'replay {i}'.encode()); files.append(p)
        return folder, files

    def test_quiet_files_only_and_no_parser_calls(self):
        folder, files = self.files()
        with patch('engine.parse_one') as parser:
            result = process(self.store, folder, files, Path('parser'), 'test', threading.Event())
        self.assertEqual(result, 'held'); parser.assert_not_called()

    def test_changed_folder_rejected_without_partial_queue(self):
        folder, files = self.files()
        def parser(exe, src, dest, stop):
            if src == files[-1]: (folder / 'new.rec').write_bytes(b'new round')
            return source()[int(src.stem)]
        with patch('engine.parse_one', side_effect=parser):
            self.assertEqual(process(self.store, folder, files, Path('parser'), 'test', threading.Event(), 0), 'failed')
        self.assertFalse(self.store.queued())

    def test_successful_scan_dedup_and_failure_retry(self):
        folder, files = self.files()
        with patch('engine.parse_one', side_effect=lambda exe, src, dest, stop: source()[int(src.stem)]) as parser:
            self.assertEqual(scan(self.store, folder, Path('parser'), 'test', threading.Event(), min_age=0), 1)
            self.assertEqual(parser.call_count, 6)
            self.assertEqual(scan(self.store, folder, Path('parser'), 'test', threading.Event(), min_age=0), 0)
        self.assertEqual(len(self.store.queued()), 1)

    def test_parser_failure_and_pause_keep_queue_empty(self):
        folder, files = self.files()
        with patch('engine.parse_one', side_effect=TimeoutError('timeout')):
            self.assertEqual(process(self.store, folder, files, Path('parser'), 'test', threading.Event(), 0), 'failed')
        stop = threading.Event(); stop.set()
        self.assertEqual(process(self.store, folder, files, Path('parser'), 'test', stop, 0), 'interrupted')
        self.assertFalse(self.store.queued())


if __name__ == '__main__': unittest.main()
