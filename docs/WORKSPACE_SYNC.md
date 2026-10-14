# Account workspaces and collector synchronization

Implemented October 14, 2026. Collector version 0.3.0.

## Data boundaries

Auth0 issuer + subject determine an opaque workspace key. Request bodies cannot select an owner. Each account receives a separate SQL schema for upload receipts, original normalized envelopes, collector connections, saved squads, review notes and its match library. Browser preferences are namespaced by workspace. The previous single approved account retains the legacy workspace. The legacy owner configuration must contain exactly one subject; changing it cannot transfer an already claimed workspace.

Recorded gameplay tables are intentionally shared among signed-in users: players, matches, rounds, events and statistics. Player Directory and Compare therefore work for console users who never upload. Stable recorded profile IDs identify in-game players; usernames are display names. A BREACH login does not verify ownership of a Ubisoft profile. Account emails, Auth0 subjects, credentials, local file paths and private notes are not part of the player catalogue.

Saved squads are currently personal analysis rosters. Shared team membership/invitations and verified Ubisoft account linking remain future work; selecting another player's profile does not grant access to their private workspace.

## Upload protocol

`POST /api/collector/matches` requires a valid Auth0 bearer token and application/json, with a 4 MiB streamed body limit. It validates the committed v1 schema and reference/completion rules, then derives ownership from the token. A SQL transaction serializes gameplay ingestion and atomically writes gameplay, personal library membership and a durable receipt. Lost responses can be retried with the same message ID. Same-message different-content and same-match different-content requests return 409; original data is retained.

Responses acknowledge messageId, matchId, workspaceId and status. `uploaded` means a new match, `duplicate` confirms already received content, and `existing_preserved` means a legacy match already existed without source-envelope hashes. That last outcome preserves the original analytics and explicitly does not certify byte equivalence. Normalized source envelopes are retained privately; original .rec files never leave the collector.

Game identifiers are stored as decimal(20,0) and returned as decimal strings, preserving unsigned values above JavaScript's integer precision. Score snapshots use bigint; event times preserve fractional seconds. Migration 005 widens these fields without reinterpreting recorded scores. Provisioning/migrations are transactional; the API database principal needs schema/table DDL access for this development deployment. Restrict and move provisioning into a controlled deployment service before public-scale hosting.

## Windows operation

Sign into the collector with the same BREACH account, then select **Enable Sync**. The collector binds unassigned queue records to the verified account and server. Switching accounts cannot move already bound uploads. Start Watching separately to collect newly completed replays. Sync automatically retries network errors, 408/425/429 and 5xx with exponential delay, jitter and Retry-After support. Scheduling and receipts survive restarts. 401/403 require sign-in or connection attention; 409/422 need review. **Retry Uploads** explicitly releases held attempts after the problem is fixed. Redirects are not followed with bearer tokens. HTTPS is required except on loopback.

Only a matching server acknowledgement marks a queue item uploaded. Exporting JSON does not acknowledge an upload. Local data is retained after upload. Disable Sync or Pause stops future requests; a request already committed on the API may still finish. Closing the app stops activity and preserves the sync preference. This version is not a Windows background service.

My Workspace shows private receipts, connections and the personal match collection. Disable/Enable controls affect only the current account's installation record. The shared Match Center, Player Directory and Compare remain available separately.

## Build and checks

Use `collector/build.py --auth-config <ignored-public-auth-config> --api-url <API-origin>` with the existing parser/compiler arguments. The supplied development installer targets loopback; remote users need a hosted HTTPS API and a build configured for it. No hosting or public installer publication is performed by this change.

- `npm test` and `npm run build`
- `python -m unittest discover -s collector/tests -v`
- `dotnet run --project tests/WorkspaceIntegration -- <absolute-backend-content-root>` creates and removes only its own synthetic LocalDB database.
- `pwsh -File scripts/check-auth.ps1` checks missing/invalid token rejection.

SQL checks cover two-account private-data isolation, shared player access, concurrent duplicates, revocation, conflicting payloads, contract alignment, numeric fidelity and rollback after a mid-import failure. Collector checks cover lost acknowledgements, durable retry timing, account switching and mismatched receipts.
