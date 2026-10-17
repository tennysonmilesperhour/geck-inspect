# QR transfer security and rollout review

This change is prepared for review on `codex/qr-transfer-detail`. It has not been merged, applied to production, or used to transfer a customer's animal. The migration is `20261017200248_secure_qr_transfers.sql`.

## Transfer contract

`create_transfer(p_animal_id, p_animal_type = 'gecko', p_to_email = null, p_sale_price = null, p_message = null)` requires the current owner's verified account. It returns `id`, `token`, `expires_at`, `claim_mode` and `status`. A missing recipient email creates a gecko QR link. An email creates an invitation restricted to that verified email. Creating a new link cancels previous pending offers for the same animal.

The database generates each new token from 32 cryptographically random bytes. It is scoped to one animal and one offer and expires after 72 hours. An open QR link is a bearer capability: any verified account with that link can explicitly claim it. The owner should share it only with the intended recipient. Email restriction remains available when the owner knows the recipient's address. The token contains no animal or owner information. Existing email links retain their identifiers and RPC signatures for older browser builds.

Legacy `transfer_requests` fields remain intact: `token` stays text, `to_email` stays non-null (open QR offers use an empty string), `animal_id` stays text, and `animal_type`, `from_user_id`, `to_user_id`, status, sale price, message and all existing timestamps keep their meanings. Existing rows get `claim_mode = 'email'`. Old browser inserts remain email-only, retain their client-generated UUID token and have their requested expiry capped by the server to 72 hours. Neither old tokens nor existing history are rewritten. New UI creation always calls the server RPC.

The transfer SELECT policy now requires a verified current Auth account, then permits the saved sender account, the verified nonempty intended email, or the saved `to_user_id` of a `claimed` transfer. The recipient-account clause enables incoming Transfer History for open QR offers, whose email is empty. The nonempty email check also closes an otherwise dangerous match between an open QR's empty recipient and an authenticated anonymous or phone-only session's missing JWT email. Unverified, deleted, banned and stale-email sessions cannot read raw transfer rows. As with existing email-transfer history, a completed row includes the sender and sale details associated with that handoff. Private keeper-note archives remain sender-only.

`get_transfer_preview(p_token)` returns only status, expiration, claim mode and authorization flags to visitors and unrelated accounts. It returns no animal ID, animal name, photo, morph, passport code, owner information, recipient email, sale price or private message. A verified intended email recipient may see the limited handoff details. An open QR recipient sees those details only after claiming. The current owner may inspect their own offer.

`claim_transfer(p_token, p_contribute = false)` returns `ok`, `animal_id` and `animal_type`. A repeated request from the successful claimant returns `already_claimed: true` only while that account still owns the same animal. Every other replay fails. `claimed_by_you` in the preview follows the same rule.

`revoke_transfer(p_transfer_id)` lets the original authenticated sender withdraw an unused offer. Revocation is safe even if the sender no longer owns the animal because it only removes an outstanding offer. It cannot undo a completed claim. Older browser cancellation updates continue to work. Direct updates cannot extend expiry, change recipients, replace tokens, retarget animals, mark claims complete or revive revoked links. Direct inserts cannot mint open QR offers.

## Atomicity and authorization

The actor must have a live, verified, non-anonymous, non-banned Auth account. Authorization reads the account email and verification from `auth.users`, never editable user metadata. The token's email must match the current account email, so stale sessions after an email change must sign in again.

Creation, claim and revocation lock the animal row before the transfer row. Claim rereads the offer under lock and checks status, expiry, email restriction and current sender ownership. It verifies the sender's saved account ID still belongs to the owner email. A collection editor cannot create or claim on behalf of the owner. Two claimants, or two different outstanding tokens for the same animal, cannot both acquire it. Successful claim cancels all sibling pending offers so they cannot revive if the animal later returns to its former keeper.

The transfer status, gecko ownership, destination collection, private-note archive and ownership history update in one transaction. Any failure, including the recipient's gecko limit, rolls them all back. Existing ownership guard switches are enabled only around those writes and disabled before returning. Public RPC wrappers use fixed qualified calls and an empty search path. Privileged implementation functions are in the unexposed `geck_private` schema with no API-role execute grant. The archive table has row security enabled and explicit limited grants.

The recipient profile is locked while resolving or creating the default collection. Existing collection placement and plan-cap checks still run. No collection membership is granted beyond the recipient's own default collection when it needs creating.

## Records and the private-note decision

The transfer keeps the original gecko row, ID, passport, photos, genetics information and lineage links. It carries forward the existing valid breeding status convention and clears seller-specific archive/sale status. Existing parent names are retained. It appends one ownership record. Care, weights, veterinary, breeding, eggs, costs and collection activity retain their original rows, authors and access policies.

There is a product ambiguity about which notes are private keeper text and which belong to the animal's history. The latest ownership migration (15 October) already lets the current animal owner read and delete its weights, care events, feeding, sheds, veterinary and ownership records, including rows recorded by another account. A transfer therefore gives the recipient that existing owner access, including notes or findings within those animal records. This change preserves those rules and original authorship. It does not add any new recipient policy. Breeding plans, eggs, collection activity, costs and other shared or third-party records remain under their existing separate access rules; they are not copied or reassigned. Any broader inheritance of shared records needs a separately approved design.

`geckos.notes` is explicitly treated as private keeper text by the buyer-packet code. The old transfer passed that field along with the gecko. To avoid granting the recipient that private text, claim archives it for the original sender and clears the field on the transferred row. The archive is `public.gecko_transfer_private_notes` with `transfer_id`, `animal_id`, `owner_user_id`, `notes`, and `created_date`. Only the original sender can read it through authenticated row security. The recipient and either collection's collaborators cannot. There are no client insert, update or delete grants. Archive retention follows existing transfer history and sender-account deletion. Genetics notes remain existing passport information.

## Authentication continuation

The client keeps the claim path through signup, verification and login, including an explicit redirect in verification email callbacks. This is navigation state, not authorization. The database still validates the token and account when the recipient presses Claim. Reopening the original QR link recovers a pending offer if browser state is lost. Reopening a completed link recovers success only for its current claimant. A callback on another device can continue with the claim path when Supabase's configured redirect allowlist accepts the app callback. A missing/expired auth callback must retain the claim path and offer login or a new verification email.

First-party product-event page paths and error URLs redact the bearer token using the existing analytics URL sanitizer. Error URLs also omit the query and hash. GA and PostHog retain main's existing token redaction and consent behavior. Claim and Auth pages send no-referrer and no-store headers.

## Approval and rollout

Before merging, approve these exact production changes: the claim-mode column and pending-offer index, the replacement participant SELECT policy and verified-account helper, the owner-only notes archive and its RLS/grants, the private transfer functions and public RPC entry points, the stricter transfer guard, the redacted preview, and the updated atomic claim. The SELECT policy restricts raw rows to verified participants and grants an open-QR recipient access only to their own completed transfer row. In particular, approve archiving private keeper notes for the sender and leaving other private/shared history under its existing permissions.

Merging to main automatically applies the migration through the repository's Supabase integration. No merge or production database action is authorized by this implementation task. The client must show an unavailable message when the new creation RPC is not deployed. It must not fall back to making open QR rows from the browser. Existing email claim and cancellation signatures remain compatible while site and database versions overlap.

The SQL harness replays the schema and runs fixture-only regressions. Its platform schemas are stand-ins, so it does not prove hosted Supabase Auth email delivery, redirect allowlists, email-provider behavior or cross-device PKCE behavior. Those require a disposable preview Auth account after the database change is approved for that preview environment.

Before a hosted preview or production release, verify the existing Supabase Auth email-confirmation setting and callback allowlist. Approve any exact callback origin/path that must be added, including the preview's AuthPortal callback and the production callback if absent. Do not widen wildcards or disable verification to make testing pass. No Auth settings, redirect allowlists or customer permissions were changed during this work.

## Database verification on 17 October

- Replayed all 292 migrations on an empty disposable database. The new migration applied successfully and a repeated application also succeeded.
- All 26 SQL regression files passed, including ownership, guard-switch, privacy, billing and erasure coverage.
- The final QR regression file passed 73 assertions. These cover owner/editor authorization, verified and stale accounts, anonymous and phone-only session isolation, redacted previews, completed-recipient transfer history, expiry, cancellation, replacement links, email restrictions, lost-success retries, onward-transfer replay, original history, sender-only notes, email case, and complete rollback when a recipient reaches their plan limit.
- Four tests using concurrent PostgreSQL connections passed: two claimants of one token, two sibling tokens for one animal, revocation while a claim waits, and expiration while a claim waits. CI now runs these after the SQL regressions.

Local verification used PostgreSQL 17.6 from an already cached image in separate `geck-transfer-sql-20261017` fixture containers, with no published port. The final review run used the `-b` replacement. The harness's platform stubs were used, with the three Supabase-only extension control files disabled inside those disposable containers to match plain Postgres. Existing containers were untouched. CI uses PostgreSQL 16. Final logs are saved locally under `.sql-harness-logs/qr-transfer-2026-10-17/`. No live customer rows were read or changed. Hosted Supabase advisors and real verification-email delivery were not exercised by this fixture harness.

Reference: [Supabase database functions](https://supabase.com/docs/guides/database/functions) and [row security](https://supabase.com/docs/guides/database/postgres/row-level-security).
