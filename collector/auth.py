"""Auth0 public-client device flow. Passwords and client secrets never enter the collector."""
import ctypes
import json
import os
import time
import uuid
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlparse
from urllib.request import Request, build_opener, HTTPRedirectHandler


class AuthError(Exception):
    pass


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise AuthError('Unexpected authentication redirect')


def post_json(url, data):
    request = Request(url, data=urlencode(data).encode(), headers={'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json'})
    try:
        with build_opener(NoRedirect).open(request, timeout=20) as response:
            content = response.read(65537); status = response.status
    except HTTPError as exc:
        content = exc.read(65537); status = exc.code; exc.close()
        if status >= 500: raise AuthError('Auth0 is temporarily unavailable. Try again later.')
    except (URLError, TimeoutError, OSError) as exc:
        raise AuthError('Cannot reach Auth0. Check your connection and try again.') from exc
    if len(content) > 65536:
        raise AuthError('Authentication response exceeds the size limit')
    try:
        if not content:
            if status >= 400: raise AuthError('Authentication request was rejected')
            return {}
        result = json.loads(content)
        if not isinstance(result, dict): raise ValueError()
        return result
    except (ValueError, UnicodeDecodeError) as exc:
        raise AuthError('Invalid authentication response') from exc


def protect(data, decrypt=False):
    """DPAPI binds the credential to this Windows user. No plaintext fallback."""
    if os.name != 'nt': raise AuthError('Windows credential protection is required')
    from ctypes import wintypes
    class Blob(ctypes.Structure):
        _fields_ = [('size', wintypes.DWORD), ('data', ctypes.POINTER(ctypes.c_ubyte))]
    source = ctypes.create_string_buffer(data); incoming = Blob(len(data), ctypes.cast(source, ctypes.POINTER(ctypes.c_ubyte))); outgoing = Blob()
    crypt = ctypes.WinDLL('crypt32', use_last_error=True); kernel = ctypes.WinDLL('kernel32', use_last_error=True)
    function = crypt.CryptUnprotectData if decrypt else crypt.CryptProtectData
    function.argtypes = [ctypes.POINTER(Blob), ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(Blob)]
    function.restype = wintypes.BOOL
    kernel.LocalFree.argtypes = [ctypes.c_void_p]; kernel.LocalFree.restype = ctypes.c_void_p
    if not function(ctypes.byref(incoming), None, None, None, None, 1, ctypes.byref(outgoing)):
        raise AuthError('Windows could not unlock the saved sign-in. Sign in again.')
    try: return ctypes.string_at(outgoing.data, outgoing.size)
    finally: kernel.LocalFree(outgoing.data)


class Auth0:
    def __init__(self, config, data_dir, request=post_json, clock=time.time):
        self.config = config; self.path = Path(data_dir) / 'auth0-session.bin'; self.request = request; self.clock = clock
        domain = config.get('domain', '')
        url = urlparse('https://' + domain)
        if not domain or url.hostname != domain or url.path or url.username or url.port or not config.get('clientId') or not config.get('audience'):
            raise AuthError('Configure the Auth0 domain, public collector client ID and API audience first.')
        self.base = 'https://' + domain; self.session = None
        if self.path.exists():
            try:
                value = json.loads(protect(self.path.read_bytes(), decrypt=True))
                if value.get('binding') == self.binding() and isinstance(value.get('access_token'), str) and isinstance(value.get('expires_at'), (int, float)):
                    self.session = value
            except (AuthError, ValueError, OSError): pass

    def binding(self):
        return [self.config['domain'], self.config['clientId'], self.config['audience']]

    def start(self):
        value = self.request(self.base + '/oauth/device/code', {'client_id': self.config['clientId'], 'audience': self.config['audience'], 'scope': 'openid offline_access'})
        if value.get('error'): raise AuthError('Auth0 device sign-in is not enabled for this collector.')
        try:
            url = urlparse(value['verification_uri_complete'])
            if url.scheme != 'https' or url.hostname != self.config['domain'] or url.username or url.port: raise ValueError()
            if not isinstance(value['device_code'], str) or not isinstance(value['user_code'], str): raise ValueError()
            value['deadline'] = self.clock() + min(1800, max(1, int(value['expires_in'])))
            value['interval'] = max(5, int(value.get('interval', 5)))
            return value
        except (KeyError, TypeError, ValueError) as exc: raise AuthError('Invalid device authorization response') from exc

    def finish(self, device, stop, notify):
        interval = device['interval']
        while self.clock() < device['deadline']:
            if stop.wait(interval): raise AuthError('Sign-in cancelled.')
            value = self.request(self.base + '/oauth/token', {'grant_type': 'urn:ietf:params:oauth:grant-type:device_code', 'device_code': device['device_code'], 'client_id': self.config['clientId']})
            if stop.is_set(): raise AuthError('Sign-in cancelled.')
            error = value.get('error')
            if error == 'authorization_pending': continue
            if error == 'slow_down': interval += 5; continue
            if error: raise AuthError('Sign-in was declined or expired. Start again.')
            self.save(value); notify('Signed in through Auth0.'); return
        raise AuthError('Pairing code expired. Start sign-in again.')

    def save(self, value):
        if not isinstance(value.get('access_token'), str) or value.get('token_type', '').lower() != 'bearer': raise AuthError('Auth0 did not return a usable access token')
        session = {'binding': self.binding(), 'access_token': value['access_token'], 'refresh_token': value.get('refresh_token') or (self.session or {}).get('refresh_token'), 'expires_at': self.clock() + max(1, int(value.get('expires_in', 0)))}
        protected = protect(json.dumps(session).encode())
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temp = self.path.with_name(self.path.name + '.' + uuid.uuid4().hex + '.tmp')
        try:
            with temp.open('xb') as stream:
                stream.write(protected); stream.flush(); os.fsync(stream.fileno())
            temp.replace(self.path)
        finally: temp.unlink(missing_ok=True)
        self.session = session

    def token(self):
        if not self.session: raise AuthError('Sign in to BREACH first.')
        if self.clock() + 60 < self.session['expires_at']: return self.session['access_token']
        refresh = self.session.get('refresh_token')
        if not refresh: raise AuthError('Your sign-in expired. Sign in again.')
        value = self.request(self.base + '/oauth/token', {'grant_type': 'refresh_token', 'refresh_token': refresh, 'client_id': self.config['clientId']})
        if value.get('error'):
            if value['error'] == 'invalid_grant':
                self.path.unlink(missing_ok=True); self.session = None
                raise AuthError('Your sign-in expired or was revoked. Sign in again.')
            raise AuthError('Auth0 could not refresh your sign-in. Try again later.')
        self.save(value); return self.session['access_token']

    def disconnect(self):
        refresh = (self.session or {}).get('refresh_token')
        if refresh:
            value = self.request(self.base + '/oauth/revoke', {'client_id': self.config['clientId'], 'token': refresh})
            if value.get('error'): raise AuthError('Could not revoke the sign-in. Try again.')
        self.path.unlink(missing_ok=True); self.session = None
