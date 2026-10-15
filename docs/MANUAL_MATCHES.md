# Manual match entry

Implemented October 15, 2026 on feature/manual-match-entry. This is a local feature, not a production deployment.

## User flow

Sign in, switch to Real Data and open Manual Entry. Start a match, select an existing recorded player or create a private manual profile, choose platform, map and start time. Record one player's kills, death, assists, headshots, operator, site and notes for each round, along with the team result. Ranked Bomb uses its regulation/overtime scoring; Custom Bomb uses an explicit first-to target. Enter the actual side for every round. Other modes and full ten-player scoreboards are outside this stage.

Drafts save after a one-second pause, with a visible saved/unsaved status. Browser recovery is account-namespaced and protects pending edits, including when the API is unavailable. On return, choose whether to restore it. A stale revision is rejected rather than overwriting a newer tab's changes; reload the saved version or export the recovery record. The server copy is available on another device after successful save. The recovery copy is available only in this browser.

Review & Finish validates terminal score, round results and numeric bounds. Missing optional stats stay null and their totals display as unknown, never measured zero. Submit is available after the draft save completes. Submitted records are read-only in this version; editing/deleting submitted records and duplicate reconciliation with later replays are not implemented.

## Ownership and provenance

Every manual endpoint requires an authenticated account, including in Development. PUT also requires X-Breach-Request: manual. Ownership is resolved from the verified Auth0 identity; requests cannot supply an owner. JSON has a 128 KiB streamed limit and rejects unknown properties. Existing replay player names cannot be renamed through this form. Manual profile IDs are UUIDs in a distinct manual-player namespace and do not verify Ubisoft ownership.

ManualMatches is a separate account-scoped SQL table provisioned transactionally by migration 006. It stores JSON payloads, a revision, status and server creation/update timestamps. Serializability plus optimistic revisions prevents conflicting tabs from silently overwriting one another. Identical save retries acknowledge the prior revision after a lost response. Submission is an atomic status transition; shared replay tables are never modified.

My Workspace links to saved drafts and submissions. Command Overview, Match Center (including match and round reports), Player Directory, Compare, Map Intelligence, Operator Intel and Insights share a Replay Only / Manual Only / Combined selector. It defaults to replay and is remembered for the account's browser session. Only submitted manual records enter analytics. Drafts never do.

Manual results remain self-reported and carry a manual source marker in match histories, reports and exports. In Manual Only and Combined modes, completed manual wins/losses and round statistics contribute to the selected calculations, including match win rates and trends. Completion does not imply verification. UI labels say recorded/completed rather than verified. Missing stats stay unknown; event timelines, damage and other unentered telemetry are not invented. Manual profiles can be selected for personal analysis; existing saved rosters also include manually entered performance for their recorded player IDs. Shared replay facts are never altered and other accounts cannot see these private records.

Manual-only mode can load without fetching the replay overview. Combined mode fails visibly if either source cannot load rather than silently returning incomplete totals. Match Center provides a manual report from the account-owned record; manual and replay match detail links respect the selected source. Source markers are retained in JSON and CSV exports. Map versions with different IDs remain separate; the app does not guess a replay map version from a manually typed map name. Live Operations remains a collector/import status page, not a combined analytics view.

## Verification

npm test includes score/unknown-stat/provenance aggregation tests. The WorkspaceIntegration runner uses a disposable LocalDB database to exercise private account separation, optimistic concurrency, retries, immutable submissions, unknown measurements and unchanged shared replay tables. Existing replay integration checks run with it.

The current implementation intentionally does not deduplicate a manually recorded match against a later replay or another user's submission. Opt-in comparisons can double-count if the same game is represented in both sources. Keep the toggle off for replay-only results; source reconciliation is future work.

## Draft deletion and account customization

Manual Entry offers DELETE DRAFT for the selected draft, with confirmation. The API requires authentication, the manual request header, a matching revision and draft status. Submitted records cannot be deleted with this action. Cross-account IDs are inaccessible; stale saves cannot recreate a deleted saved draft. Successful deletion clears only that draft's browser recovery copy. My Workspace refreshes the manual summary along with its collection and connection data.

The separate My Account page (`#/account`), reached only through the bottom-left account section or top-bar profile icon in the navigation UI, includes a private account profile: display name (80 characters), optional bio (500), and optional picture. PNG/JPEG/WebP uploads up to 5 MB are decoded, center-cropped and redrawn to 128px PNG in the browser, removing original metadata. The API accepts only bounded PNG data URLs, not external image URLs or SVG. Picture removal and profile updates persist in the caller's AccountProfile table (migration 007). Optimistic revision checks reject conflicting tabs. Sidebar and top-bar account links show the saved name/initials or picture.

Profile editing does not change Auth0 credentials, recorded player names or Ubisoft ownership. Profiles are private for now; public user pages, account deletion and Ubisoft linking are separate future stages. Tests cover private profile isolation, avatar roundtrips/removal, validation and draft deletion conflicts in a disposable database.
