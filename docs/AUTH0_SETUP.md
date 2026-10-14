# Auth0 integration

BREACH uses Auth0 Universal Login for website accounts and the OAuth device-code flow for the Windows collector. BREACH never receives passwords. Match storage remains in the existing SQL database; Auth0 is the identity provider.

## Dashboard configuration

Create these resources in your own Auth0 tenant:

- **BREACH Website**: Single Page Application. Add the development website origins to Allowed Callback URLs, Allowed Logout URLs and Allowed Web Origins. Each is `http://localhost:5173` and `http://127.0.0.1:5173`. Add the actual HTTPS website origin when hosting is configured; avoid wildcard callbacks.
- **BREACH Windows Collector**: Native application, public client with Token Endpoint Authentication Method `None`. Advanced Settings → Grant Types must include Device Code and Refresh Token. Keep its default database connection enabled. No collector client secret is used.
- **BREACH API**: identifier `https://breach-intel-api`, Auth0 token profile, RS256, per-app authorization. Under Application Access, grant **User-Delegated Access** to the website and collector. They do not need Client Access or Anonymous Access. In API Settings enable **Allow Offline Access** for the collector's refresh tokens.

Dashboard security settings and login/password prompts are completed by the account owner. The Auth0 dashboard administrator account is separate from a BREACH end-user account: the first BREACH sign-in may require signing up in Universal Login.

## Local configuration

Copy `.env.example` to `.env.local`, then fill in the public domain, website client ID and audience. Vite-prefixed values are public browser configuration. Never put a secret or token in them. Restart Vite after editing.

In ignored `backend/Breach.Intel.Api/appsettings.Development.json`, set:

```json
{
  "Auth0": {
    "Domain": "YOUR-TENANT.us.auth0.com",
    "Audience": "https://breach-intel-api",
    "AllowedSubjects": ["YOUR-VERIFIED-END-USER-SUBJECT"]
  }
}
```

`AllowedSubjects` limits access to the existing single private replay workspace. A newly registered account gets no imported data automatically. Obtain its subject from `/api/account` using a successfully verified Auth0 access token. An ID token or unverified decoded token is not accepted as evidence. Keep the real subject in ignored configuration only. Production must configure Auth0 and explicitly grant workspace access; missing configuration prevents startup. This allowlist is an interim private-workspace authorization model. Hosted squads and account-owned matches need a membership/ownership migration before a public multi-user release.

The collector's build configuration contains only `domain`, its own Native `clientId`, and `audience`. Supply it via `collector/build.py --auth-config PATH`. The build rejects extra keys so secrets cannot be bundled accidentally. The source app also accepts `--auth-config PATH`. Credentials are stored separately as a Windows DPAPI-encrypted session file in the collector data directory; they are never added to SQLite queue records, match exports or diagnostics. Disconnect revokes the saved refresh token and removes the local session after successful revocation.

## Verification

```powershell
npm test
npm run build
.tmp/collector-venv/Scripts/python.exe -m unittest discover -s collector/tests -v
pwsh -NoProfile -File scripts/check-auth.ps1
```

The API smoke check uses a separate process/port and synthetic invalid credentials. It confirms missing/invalid access tokens cannot read matches, account, squads or workflow records. Collector tests cover pending approval, polling slowdown, cancellation, denied approval, rotation/restart, invalid-grant cleanup, provider/client binding and real Windows encryption. Real browser sign-in and collector device approval still require the user to complete Auth0 prompts.

Production email delivery for password recovery/verification needs an email provider configured in Auth0. Public hosting, multi-user ownership, match ingestion receipts and automatic upload retries remain separate deployment stages. Sign-in alone does not upload any match.

References: [React SDK](https://auth0.com/docs/quickstart/spa/react), [device flow](https://auth0.com/docs/get-started/authentication-and-authorization-flow/device-authorization-flow/call-your-api-using-the-device-authorization-flow).
