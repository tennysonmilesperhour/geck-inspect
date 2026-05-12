-- Encryption-at-rest for social_platform_connections.access_token.
-- App passwords and OAuth tokens are now stored encrypted with AES-GCM
-- in `access_token_ciphertext`, encrypted/decrypted by the
-- set-platform-connection and publish-social-post edge functions using
-- the PLATFORM_CONNECTIONS_KEY secret. The plaintext `access_token`
-- column stays for backwards compatibility but should be empty for new
-- rows; older rows fall back to it until rewritten through the new flow.

alter table public.social_platform_connections
  add column if not exists access_token_ciphertext text,
  add column if not exists access_token_iv text,
  add column if not exists refresh_token_ciphertext text,
  add column if not exists refresh_token_iv text;

comment on column public.social_platform_connections.access_token is
  'DEPRECATED for new writes. Plaintext token kept for backwards compat with rows written before encryption-at-rest landed. Read path falls back here if access_token_ciphertext is null. The set-platform-connection edge function clears this on every write.';
comment on column public.social_platform_connections.access_token_ciphertext is
  'AES-GCM ciphertext of the platform access token / app password, base64-encoded. Encrypted by set-platform-connection edge function; decrypted by publish-social-post.';
comment on column public.social_platform_connections.access_token_iv is
  'Base64-encoded 12-byte IV used for the AES-GCM encryption of access_token_ciphertext. Stored alongside ciphertext per row.';

-- Tighten RLS: users can READ their own rows but cannot INSERT or UPDATE
-- directly. All writes must go through set-platform-connection (which runs
-- with the service role and encrypts before persisting). DELETE is still
-- allowed so users can disconnect a platform from the UI.
drop policy if exists "Users manage their own connections" on public.social_platform_connections;
drop policy if exists "Users read their own connections" on public.social_platform_connections;
drop policy if exists "Users delete their own connections" on public.social_platform_connections;

create policy "Users read their own connections"
  on public.social_platform_connections
  for select
  using (user_id = auth.uid());

create policy "Users delete their own connections"
  on public.social_platform_connections
  for delete
  using (user_id = auth.uid());

-- INSERT and UPDATE are intentionally NOT granted to authenticated; service
-- role bypasses RLS so the edge function can still write.
