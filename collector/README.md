# BREACH Windows Collector 0.3.1 — Beta

The Windows x64 collector watches Siege replay folders, parses completed Ranked Bomb matches, and uploads normalized match data to the hosted BREACH API after sign-in and Enable Sync. Python, SQL Server and developer tools are not required on the player's PC.

## Install and connect

1. Download the beta from My Workspace or Collector Setup on the BREACH website.
2. Run the installer and open BREACH Collector from Start.
3. Sign in using the same BREACH account as the website. Confirm the matching device code in your browser.
4. Use Detect or Browse to select the game's MatchReplay folder.
5. Enable Sync and Start Watching. Keep the app open. Files must settle for 120 seconds before collection.
6. Check My Workspace for acknowledged uploads. Unsupported/incomplete matches remain held rather than being invented or partially uploaded.

The installer is unsigned. Windows may report an unrecognized app. Second-PC installation compatibility is still pending; this is a friends-and-family beta, not a final production release.

## Data and recovery

Original .rec files stay on the PC. Only normalized match data is sent to the configured BREACH API. Gameplay stats are shared with signed-in users; account receipts and queues stay private. Auth0 manages browser sign-in, and saved credentials use Windows protection.

The local SQLite queue and server acknowledgements survive restarts. Network failures retry while sync is enabled and the app is open. Conflicting content is held for review. Local queues bound to another server/account are not silently moved. Existing users with a local-development collector should retain their old queue and scan originals into a separate hosted configuration if needed.

Uninstall removes installed program files while preserving queue data and game replays. No automatic startup, Windows service or automatic updater is installed. Updates are downloaded manually.

## Verification

- 38 collector tests passed.
- Hosted Auth0 device sign-in passed.
- A real existing replay was uploaded to the hosted API and acknowledged as existing_preserved, preserving existing gameplay facts.
- A deliberately lost response was retried with the same message ID; duplicate acknowledgement succeeded. Restart retained the receipt and did not resend the completed item.
- New-match insertion is covered by isolated SQL integration tests; fresh-match hosted insertion and a clean second-PC installation remain pending.
- Packaged runtime self-test and published SHA-256 checks are recorded with the release.

## Build

Use Windows x64, the collector build virtual environment, the reviewed siege-dissect parser and NSIS:

```powershell
.tmp/collector-venv/Scripts/python.exe collector/build.py --parser <parser.exe> --makensis <makensis.exe> --auth-config <public-auth-config.json> --api-url <https-api-origin> --output releases/collector/0.3.1-hosted
```

Auth configuration contains only public domain, native client ID and audience. Never package sessions, queue databases or private developer settings. The installer includes third-party licenses.

The website's public/downloads/collector-release.json records the reviewed installer name, size and SHA-256. scripts/package-hosting.ps1 verifies these and copies only that installer into the website package; build work directories stay private. Update metadata only after verifying a new build.

See [workspace sync](../docs/WORKSPACE_SYNC.md) for the protocol and isolation guarantees.
