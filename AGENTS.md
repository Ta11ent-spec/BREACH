# Release version policy

The user reset the website version to **V0.1.5** on October 16, 2026.
For each subsequent user-requested published update, increment the website patch number by **2**: V0.1.7, V0.1.9, V0.1.11, and so on. Treat implementation iterations within one update as one release, not multiple versions.
Update the sidebar patch notes to describe the actual release, plus package.json and the root package-lock.json version fields. Do not change dependency versions when changing the app version. The footer imports the same VERSION as the patch notes.
The Windows collector has a separate version sequence; the current collector release is v0.3.9 (validated Ranked Bomb opening duels and clutches). Keep its executable version, installer, download metadata, checksum and release notes consistent.
