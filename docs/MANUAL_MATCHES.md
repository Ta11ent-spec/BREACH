# Manual match entry

Implemented October 15, 2026 on feature/manual-match-entry. This is a local feature, not a production deployment.

## User flow

Sign in, switch to Real Data and open Manual Entry. Start a match, select an existing recorded player or create a private manual profile, choose platform, map and start time. Record one player's kills, death, assists, headshots, operator, site and notes for each round, along with the team result. Ranked Bomb uses its regulation/overtime scoring; Custom Bomb uses an explicit first-to target. Enter the actual side for every round. Other modes and full ten-player scoreboards are outside this stage.

Drafts save after a one-second pause, with a visible saved/unsaved status. Browser recovery is account-namespaced and protects pending edits, including when the API is unavailable. On return, choose whether to restore it. A stale revision is rejected rather than overwriting a newer tab's changes; reload the saved version or export the recovery record. The server copy is available on another device after successful save. The recovery copy is available only in this browser.

Review & Finish validates terminal score, round results and numeric bounds. Missing optional stats stay null and their totals display as unknown, never measured zero. Submit is available after the draft save completes. Submitted records are read-only in this version; editing/deleting submitted records and duplicate reconciliation with later replays are not implemented.

## Ownership and provenance

Every manual endpoint requires an authenticated account, including in Development. PUT also requires X-Breach-Request: manual. Ownership is resolved from the verified Auth0 identity; requests cannot supply an owner. JSON has a 128 KiB streamed limit and rejects unknown properties. Existing replay player names cannot be renamed through this form. Manual profile IDs are UUIDs in a distinct manual-player namespace and do not verify Ubisoft ownership.

ManualMatches is a separate account-scoped SQL table provisioned transactionally by migration 006. It stores JSON payloads, a revision, status and server creation/update timestamps. Serializability plus optimistic revisions prevents conflicting tabs from silently overwriting one another. Identical save retries acknowledge the prior revision after a lost response. Submission is an atomic status transition; shared replay tables are never modified.

My Workspace links to saved drafts and submissions. Player Directory and Compare have an explicit Include My Manual Matches toggle, off by default and scoped to the signed-in browser session. Only submitted records enter that view. They remain unverified and do not contribute to verified replay match win rates; other player statistics include their entered measurements when enabled. Private manual profiles become visible in that view. Manual history links open the manual record rather than the replay report. Other accounts cannot see these records. Imported Match Center, overview, map/operator intelligence and team reports continue to use replay data only. Manual statistics are not published into the global player catalogue.

## Verification

npm test includes score/unknown-stat/provenance aggregation tests. The WorkspaceIntegration runner uses a disposable LocalDB database to exercise private account separation, optimistic concurrency, retries, immutable submissions, unknown measurements and unchanged shared replay tables. Existing replay integration checks run with it.

The current implementation intentionally does not deduplicate a manually recorded match against a later replay or another user's submission. Opt-in comparisons can double-count if the same game is represented in both sources. Keep the toggle off for replay-only results; source reconciliation is future work.
