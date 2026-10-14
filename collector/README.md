# BREACH Windows collector — private preview 0.2.0

The collector watches PC replay folders, invokes the bundled siege-dissect parser, converts completed Ranked Bomb matches into contract v1 JSON and keeps a durable local SQLite queue. Configured builds include Auth0 browser sign-in and Windows-protected token storage. End users do not need Python, a terminal or SQL Server. Match upload is not implemented yet; signing in does not upload the queue. See [Auth0 setup](../docs/AUTH0_SETUP.md).

## Using the preview

1. Run `BREACH-Collector-Setup-0.2.0.exe`, then open BREACHCollector from Start. **Sign in** opens Auth0 in your browser; check the displayed device code and complete sign-in yourself. **Pause** cancels a pending sign-in.
2. Select **Detect** for a common Steam/Ubisoft installation, or **Browse** to select MatchReplay. Selecting one match folder is useful for an initial check.
3. Select **Scan now**. New/changed replay files must be quiet for 120 seconds. Unsupported or incomplete matches stay held; parser failures remain visible.
4. Open **Ready to export**, select a match and choose **Export selected JSON**. Each file follows the website's collector contract. Export never removes the queued record.
5. **Start watching** checks every 30 seconds, at most 20 unprocessed folders per pass. **Pause** stops the current parser and retains completed queue records. Closing the app stops watching.

Scan now also retries held/failed records. Unchanged completed records are skipped. Double-click a row for full details. Export diagnostics writes a local file that can contain folder paths and parser messages; review it before sharing.

Files install per user under `%LOCALAPPDATA%\Programs\BREACH Collector`. The independent queue/settings database lives under `%LOCALAPPDATA%\BREACH\CollectorData`. Windows Apps uninstall removes only the installed program files, preserving queue data and original game replays. No service, automatic startup or automatic update is installed.

This build is an **unsigned private preview**. Release signing and a second-PC compatibility check remain release gates. Do not treat it as a public production release.

## Developer build

Requirements: Windows x64, Python 3.14, Go (for parser build metadata/license collection), the reviewed siege-dissect executable and a portable NSIS compiler. These are build-machine requirements only.

```powershell
python -m venv .tmp/collector-venv
.tmp/collector-venv/Scripts/python.exe -m pip install -r collector/requirements-build.txt
.tmp/collector-venv/Scripts/python.exe -m unittest discover -s collector/tests -v
.tmp/collector-venv/Scripts/python.exe collector/build.py --parser "C:\path\siege-dissect.exe" --makensis "C:\path\makensis.exe"
```

Output: `.tmp/collector-release/BREACH-Collector-Setup-0.2.0.exe`, a portable `BreachCollector` directory and `SHA256SUMS.json`. Pass `--auth-config` with the three public collector settings to include sign-in. Build artifacts and private replay data stay out of Git. NSIS's official distribution is [here](https://sourceforge.net/projects/nsis/files/NSIS%203/3.13/). The build includes parser, runtime and dependency license notices. The Go module cache must contain licenses for the dependencies recorded in the supplied parser's build metadata; a missing notice fails the build.

The parser manifest pins the exact SHA-256 of the supplied executable; the app checks it before parsing. Parser version provenance uses a binary digest, with full Go build metadata shipped separately. Updating parser output requires adapter/contract regression tests before replacing the bundled parser.

To run the source UI, pass `--parser` and provide the generated assets directory from the build in `collector/assets`, or use the packaged preview. Packaged runtime verification:

```powershell
& .tmp/collector-release/BreachCollector/BreachCollector.exe --self-test "C:\path\runtime-check.json"
```

The self-test checks bundled Tk, SQLite, schema resources and parser checksum without opening a normal collector session or touching the user's queue.

## Data integrity

- Stable match/round/player/event IDs retain the legacy importer's identity convention.
- Round hashes describe original `.rec` bytes, never exported JSON.
- Missing or ambiguous measurements remain null; duplicate names never identify event participants by guesswork.
- Completion requires contiguous rounds, consistent per-round score progression, a supported Ranked Bomb mode and a terminal score. Unsupported formats are held.
- Parsing has a timeout and can be cancelled. Changed source folders fail before queue commit.
- Queue commits are transactional with SQLite WAL and FULL durability. Interrupted parsing is recoverable.
- Same match and replay hashes return the existing message ID. Conflicting replay bytes are rejected while retaining the original.
- There is no upload acknowledgement or deletion path yet; exporting retains every queue record.

## Next stage

Auth0 handles sign-in and password recovery. BREACH still needs hosted workspace memberships and authenticated match ingestion with durable receipts/retries. No passwords, provider secrets or device credentials belong in contract payloads.

Before public distribution: test installation, scanning, restart, export and uninstall on a second Windows PC without developer runtimes; configure signing; finish hosted identity/workspaces and authenticated ingestion; verify offline upload retry/receipts; then publish a trusted download and update channel.
