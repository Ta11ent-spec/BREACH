# BREACH collector data contract 1.0.0

Status: v1 is implemented by the local Windows collector preview. The website provides downloadable JSON Schema, a synthetic example and local preflight validation. The collector validates the full schema plus referential invariants before queueing. Account pairing and upload endpoints remain future work; see [collector setup and build instructions](../collector/README.md).

## Product flow

Windows MatchReplay `.rec` files → existing parser → normalization → one versioned match envelope → durable local queue → future authenticated ingestion API → account/workspace storage → website activity and analytics refresh.

The distributable collector must not require Python, terminal use or a user-maintained SQL Server database. The current importer is its normalization foundation, not the downloadable application.

## Files and envelope

- Schema: `public/contracts/collector-v1.schema.json` (JSON Schema draft 2020-12).
- Synthetic example: `public/contracts/collector-v1.example.json`. It describes an incomplete match with unknown measurements and contains no real user data.
- Root fields: `schemaVersion`, UUID `messageId`, collector installation/version, source provenance and normalized payload.
- One envelope contains one match and its rounds, players, appearances, events and issues. Local preflight accepts at most 4 MiB; a future API must enforce a decoded-body limit too.
- UTC timestamps must include `Z`. Unknown measurements and identifiers are explicit nulls. Missing required statistic fields do not mean zero.
- Map/operator/weapon IDs are decimal strings to preserve game IDs without JavaScript integer rounding. IDs are identity, not proof of a known name.
- Entity IDs preserve the normalizer's existing stable UUID or hashed identifiers. The legacy importer derives round IDs from the match ID and source round index, and event IDs from round ID and sequence using its SHA-256-derived ID function. Do not introduce a different identity scheme without a migration/version change.
- A round number is one-based, while the parser's source index is zero-based. Player identity uses a known profile ID when available; anonymous match-scoped identities must never be merged across matches by username alone.
- `sourceSha256` hashes the original replay source bytes for that round. The existing SQL loader hashes exported raw JSON instead; the collector adapter must explicitly supply the replay-byte digest rather than treating that legacy digest as equivalent.
- The payload retains raw score/damage snapshots separately. Their presence does not authorize summing cumulative values into analytics.
- Event player IDs are nullable when identity is ambiguous; retain usernames as recorded labels without treating them as confirmed IDs.
- Local absolute file paths, account IDs, workspace ownership and credentials are not fields in this envelope.

## Structural and semantic validation

The bundled browser validator checks the supported schema subset and cross-record invariants. It rejects unknown fields, unsupported versions, duplicate entity IDs/round numbers, duplicate player-round pairs, unresolved references, duplicate event sequences, contradictory known team outcomes and impossible headshot counts. UUID fields have a shape check; entity IDs are bounded opaque strings.

Every round has distinct slots 0 and 1. Side may be ATK, DEF or UNKNOWN; team index and outcomes can remain unknown. A declared complete match needs contiguous rounds and known outcomes. This is necessary but not sufficient: future server ingestion must independently validate supported game/mode completion rules, source hashes and event identity evidence. Browser preflight is not an acceptance/ownership decision.

## Future authenticated upload protocol

Proposed endpoint: `POST /api/collector/v1/matches`, authenticated using a paired device token. The authenticated server context supplies the account and permitted workspace; ownership is never taken from player IDs or other payload fields.

The collector generates a message UUID once and keeps it across retries. The server records that key within the authenticated installation/workspace scope, plus a content digest. Repeating the same message and content returns the original receipt; the same key with different content returns 409. Match/round source IDs and hashes also detect duplicate content submitted under a new message key. Conflicting raw sources require review, not silent overwrite.

Acceptance is transactional for one envelope. A receipt includes server receipt/job ID, accepted/duplicate outcome, affected match ID and validation warnings. The collector removes a queued item only after a durable acceptance/duplicate receipt. Suggested failures: 400 malformed input, 401/403 invalid identity/access, 409 source/key conflict, 413 oversized body, 422 unsupported schema or semantic mismatch, 429 throttling, and retryable 5xx failures.

Retry network/5xx failures with bounded exponential backoff and jitter; honor Retry-After. Keep rejected/unsupported records available for diagnostics and user-initiated retry. Retain queue state across process/device restarts. Do not retry authorization or semantic failures endlessly.

## Pairing and job status

Future pairing should bind a user-approved collector installation to the chosen workspace, store credentials in protected Windows storage and support disconnect/revocation. Installation ID is correlation data, not authentication.

Collector jobs need explicit discovered, held, parsing, queued, uploading, accepted, duplicate and failed states, with timestamps, reason codes, parser/normalizer versions and attempts. Heartbeats report connection and last-seen state independently of replay timestamps. Do not derive “online” from a recent database import.

The current status API reads committed database import batches and warnings. Existing parser-held/failed attempts outside those batches are not observable until the importer/collector reports them. Live Operations currently shows post-match activity; true during-match telemetry remains a separate data-source decision.

## Implementation gates

1. Implemented: replay-to-envelope converter preserves existing identity conventions and hashes original replay bytes.
2. Implemented locally: full JSON Schema validation and semantic checks, with a real six-round replay also checked against website preflight. Server-side validation remains necessary.
3. Implement account/workspace authorization, paired installation storage, authenticated ingestion and receipts.
4. Test interrupted uploads, duplicate replay delivery, conflicting sources, offline recovery, parser updates and unsupported versions.
5. Package and sign the Windows installer and implement a trusted update channel after end-to-end tests pass.
