# BREACH Windows Collector 0.3.1 — Beta

The Windows x64 collector watches Siege replay folders, parses completed Ranked, Unranked/Standard and Casual matches, and uploads normalized match data to the hosted BREACH API after sign-in and Enable Sync. Python, SQL Server and developer tools are not required on the player's PC.

## Install and connect

1. Download the beta from My Workspace or Collector Setup on the BREACH website.
2. Run the installer and open BREACH Collector from Start.
3. Sign in using the same BREACH account as the website. Confirm the matching device code in your browser.
4. Use Detect or Browse to select the game's MatchReplay folder.
5. Enable Sync once. Watching starts automatically after selecting a replay folder. Leave Start with Windows enabled to launch at sign-in; close to the tray to keep collecting. Files must settle for 120 seconds before collection.
6. Check My Workspace for acknowledged uploads. Unsupported/incomplete matches remain held rather than being invented or partially uploaded.

The installer is unsigned. Windows may report an unrecognized app. Second-PC installation compatibility is still pending; this is a friends-and-family beta, not a final production release.

## Data and recovery

Original .rec files stay on the PC. Only normalized match data is sent to the configured BREACH API. Gameplay stats are shared with signed-in users; account receipts and queues stay private. Auth0 manages browser sign-in, and saved credentials use Windows protection.

The local SQLite queue and server acknowledgements survive restarts. Network failures retry while sync is enabled and the app is open. Conflicting content is held for review. Local queues bound to another server/account are not silently moved. Existing users with a local-development collector should retain their old queue and scan originals into a separate hosted configuration if needed.

Uninstall removes installed program files while preserving queue data and game replays. The installer offers per-user Windows startup (enabled by default and removable in the app). No Windows service is installed. The tray menu provides Open, Resume watching, Pause collection and sync, and Quit. Explicit Pause persists across launches; Resume Watching and Enable Sync resume collection and upload. Quit retains saved sync/watch preferences. Updates are downloaded manually; quit from the tray before installing. Uninstall removes this installation's startup entry. The PC must be awake and signed in to collect.

## Verification

- 46 collector tests passed, including background lifecycle and startup settings.
- Hosted Auth0 device sign-in passed.
- A real existing replay was uploaded to the hosted API and acknowledged as existing_preserved, preserving existing gameplay facts.
- A deliberately lost response was retried with the same message ID; duplicate acknowledgement succeeded. Restart retained the receipt and did not resend the completed item.
- New-match insertion is covered by isolated SQL integration tests; fresh-match hosted insertion and a clean second-PC installation remain pending.
- Packaged runtime self-test and published SHA-256 checks are recorded with the release.

## Build

Use Windows x64, the collector build virtual environment, the reviewed siege-dissect parser and NSIS:

```powershell
.tmp/collector-venv/Scripts/python.exe collector/build.py --parser <parser.exe> --makensis <makensis.exe> --auth-config <public-auth-config.json> --api-url <https-api-origin> --output releases/collector/0.3.7-hosted
```

Auth configuration contains only public domain, native client ID and audience. Never package sessions, queue databases or private developer settings. The installer includes third-party licenses.

The website's public/downloads/collector-release.json records the reviewed installer name, size and SHA-256. scripts/package-hosting.ps1 verifies these and copies only that installer into the website package; build work directories stay private. Update metadata only after verifying a new build.

See [workspace sync](../docs/WORKSPACE_SYNC.md) for the protocol and isolation guarantees.

Folder detection reads Steam installation records, registered libraryfolders.vdf paths, game manifests and registered Ubisoft/game install locations. Multiple found folders prompt for selection. It does not scan entire drives; Browse remains the fallback. Supported complete Ranked Bomb, Unranked/Standard Bomb and Casual (Bomb/QuickMatchBomb, SecureArea, Hostage) matches upload with their original playlist. The recorded regulation/overtime format and every score must validate. Missing early rounds, unsupported formats and parser failures remain local. Website playlist filtering defaults to Ranked.

Version 0.3.7 retries previously unsupported-mode holds once on upgrade; acknowledged uploads are untouched. Parser panics are not fixed by playlist support: retain the affected replay folder and export diagnostics to investigate.
