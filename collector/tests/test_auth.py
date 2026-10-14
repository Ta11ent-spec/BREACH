import json
import os
import sys
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from auth import Auth0, AuthError, protect

CONFIG = {'domain': 'example.us.auth0.com', 'clientId': 'public-client', 'audience': 'https://breach-intel-api'}


class PollStop:
    def __init__(self): self.intervals = []
    def wait(self, seconds): self.intervals.append(seconds); return False
    def is_set(self): return False


class AuthTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.protection = patch('auth.protect', side_effect=lambda data, decrypt=False: data[7:] if decrypt else b'LOCKED:' + data)
        self.protection.start(); self.addCleanup(self.protection.stop)

    def client(self, request=lambda *args: {}): return Auth0(CONFIG, self.temp.name, request=request, clock=lambda: 100)

    def test_device_sign_in_honors_pending_and_slow_down(self):
        responses = iter([{'error': 'authorization_pending'}, {'error': 'slow_down'}, {'access_token': 'access', 'refresh_token': 'refresh', 'token_type': 'Bearer', 'expires_in': 300}])
        client = self.client(lambda *args: next(responses)); stop = PollStop(); messages = []
        client.finish({'interval': 5, 'deadline': 200, 'device_code': 'private-device-code'}, stop, messages.append)
        self.assertEqual(stop.intervals, [5, 5, 10]); self.assertEqual(client.token(), 'access')
        self.assertEqual(messages, ['Signed in through Auth0.'])
        self.assertTrue(client.path.read_bytes().startswith(b'LOCKED:'))

    def test_cancel_never_saves_a_session(self):
        client = self.client(); stop = threading.Event(); stop.set()
        with self.assertRaisesRegex(AuthError, 'cancelled'): client.finish({'interval': 5, 'deadline': 200}, stop, lambda _: None)
        self.assertFalse(client.path.exists())

    def test_decline_preserves_unsigned_state(self):
        client = self.client(lambda *args: {'error': 'access_denied'})
        with self.assertRaises(AuthError): client.finish({'interval': 5, 'deadline': 200, 'device_code': 'code'}, PollStop(), lambda _: None)
        self.assertIsNone(client.session)

    def test_credentials_are_bound_to_provider_client_and_audience(self):
        client = self.client(); client.save({'access_token': 'access', 'refresh_token': 'refresh', 'token_type': 'Bearer', 'expires_in': 300})
        self.assertEqual(self.client().token(), 'access')
        other = Auth0({**CONFIG, 'clientId': 'different'}, self.temp.name)
        self.assertIsNone(other.session)

    def test_refresh_rotation_survives_restart_and_revocation_clears_session(self):
        client = self.client(lambda *args: {'access_token': 'new', 'refresh_token': 'rotated', 'token_type': 'Bearer', 'expires_in': 300})
        client.save({'access_token': 'old', 'refresh_token': 'original', 'token_type': 'Bearer', 'expires_in': 1})
        self.assertEqual(client.token(), 'new'); self.assertEqual(self.client().session['refresh_token'], 'rotated')
        client.session['expires_at'] = 0; client.request = lambda *args: {'error': 'invalid_grant'}
        # An invalid grant is already revoked; local cleanup should not need another network request.
        with self.assertRaises(AuthError): client.token()
        self.assertIsNone(client.session); self.assertFalse(client.path.exists())

    def test_foreign_verification_url_is_rejected(self):
        client = self.client(lambda *args: {'verification_uri_complete': 'https://attacker.test/activate', 'device_code': 'secret', 'user_code': 'code', 'expires_in': 600})
        with self.assertRaises(AuthError): client.start()

    def test_config_cannot_smuggle_a_path_or_credentials(self):
        for domain in ('example.us.auth0.com/path', 'user@example.us.auth0.com', 'example.us.auth0.com:443'):
            with self.assertRaises(AuthError): Auth0({**CONFIG, 'domain': domain}, self.temp.name)


class WindowsProtectionTests(unittest.TestCase):
    @unittest.skipUnless(os.name == 'nt', 'Windows DPAPI only')
    def test_real_windows_protection_round_trip(self):
        value = b'synthetic-test-token-not-a-credential'
        encrypted = protect(value)
        self.assertNotIn(value, encrypted)
        self.assertEqual(protect(encrypted, decrypt=True), value)

if __name__ == '__main__': unittest.main()
