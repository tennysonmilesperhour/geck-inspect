import { webcrypto } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  APPLE_REVOKE_URL,
  APPLE_TOKEN_URL,
  appleClientSecret,
  appleConfigFromEnv,
  exchangeAppleCode,
  idTokenSubject,
  revokeStoredAppleToken,
} from '../../../supabase/functions/_shared/apple-auth.ts';

async function testKey() {
  const pair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const der = Buffer.from(await webcrypto.subtle.exportKey('pkcs8', pair.privateKey)).toString('base64');
  const pem = `-----BEGIN PRIVATE KEY-----\n${der.match(/.{1,64}/g).join('\n')}\n-----END PRIVATE KEY-----`;
  return { pem, publicKey: pair.publicKey };
}

const b64url = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');

function tableClient(row, error = null) {
  const calls = [];
  return {
    calls,
    from: (table) => ({
      select: (columns) => ({
        eq: (column, value) => ({
          maybeSingle: async () => { calls.push({ table, columns, column, value }); return { data: row, error }; },
        }),
      }),
    }),
  };
}

const quiet = { warn: vi.fn(), error: vi.fn() };

describe('Apple client secret', () => {
  it('is an ES256 JWT for the bundle id that verifies with the key', async () => {
    const { pem, publicKey } = await testKey();
    const config = { teamId: 'TEAM123456', keyId: 'KEY1234567', privateKey: pem, clientId: 'com.geckinspect.app' };
    const jwt = await appleClientSecret(config, 1_700_000_000);
    const [h, p, sig] = jwt.split('.');
    expect(JSON.parse(Buffer.from(h, 'base64url'))).toEqual({ alg: 'ES256', kid: 'KEY1234567', typ: 'JWT' });
    expect(JSON.parse(Buffer.from(p, 'base64url'))).toEqual({
      iss: 'TEAM123456', iat: 1_700_000_000, exp: 1_700_000_300, aud: 'https://appleid.apple.com', sub: 'com.geckinspect.app',
    });
    const ok = await webcrypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' }, publicKey, Buffer.from(sig, 'base64url'), new TextEncoder().encode(`${h}.${p}`),
    );
    expect(ok).toBe(true);
  });

  it('reads the secrets, mends pasted \\n line breaks and defaults the client id', () => {
    const env = { APPLE_TEAM_ID: ' T ', APPLE_KEY_ID: 'K', APPLE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----' };
    expect(appleConfigFromEnv((n) => env[n])).toEqual({
      teamId: 'T', keyId: 'K', privateKey: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----', clientId: 'com.geckinspect.app',
    });
    expect(appleConfigFromEnv((n) => (n === 'APPLE_KEY_ID' ? '' : env[n]))).toBeNull();
  });
});

describe('Apple code exchange', () => {
  it('posts the code and returns the refresh token with its owner', async () => {
    const { pem } = await testKey();
    const config = { teamId: 'T', keyId: 'K', privateKey: pem, clientId: 'com.geckinspect.app' };
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ refresh_token: 'r1', id_token: `x.${b64url({ sub: '001.abc' })}.y` })));
    await expect(exchangeAppleCode('code1', config, fetchImpl)).resolves.toEqual({ refreshToken: 'r1', sub: '001.abc' });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(APPLE_TOKEN_URL);
    const form = new URLSearchParams(init.body);
    expect(form.get('grant_type')).toBe('authorization_code');
    expect(form.get('code')).toBe('code1');
    expect(form.get('client_id')).toBe('com.geckinspect.app');
  });

  it('throws when Apple refuses', async () => {
    const { pem } = await testKey();
    const config = { teamId: 'T', keyId: 'K', privateKey: pem, clientId: 'c' };
    const fetchImpl = async () => new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 });
    await expect(exchangeAppleCode('bad', config, fetchImpl)).rejects.toThrow('invalid_grant');
  });

  it('reads the sub of an id token and survives junk', () => {
    expect(idTokenSubject(`a.${b64url({ sub: 's' })}.b`)).toBe('s');
    expect(idTokenSubject('nonsense')).toBe('');
  });
});

describe('revoking on deletion', () => {
  it('revokes the stored refresh token', async () => {
    const { pem } = await testKey();
    const env = { APPLE_TEAM_ID: 'T', APPLE_KEY_ID: 'K', APPLE_PRIVATE_KEY: pem };
    const admin = tableClient({ refresh_token: 'r1' });
    const fetchImpl = vi.fn(async () => new Response('', { status: 200 }));
    await expect(revokeStoredAppleToken(admin, 'user-1', { env: (n) => env[n], fetchImpl, log: quiet })).resolves.toBe('revoked');
    expect(admin.calls[0]).toEqual({ table: 'apple_sign_in_tokens', columns: 'refresh_token', column: 'user_id', value: 'user-1' });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(APPLE_REVOKE_URL);
    const form = new URLSearchParams(init.body);
    expect(form.get('token')).toBe('r1');
    expect(form.get('token_type_hint')).toBe('refresh_token');
  });

  it('does nothing for a login without a stored token', async () => {
    const fetchImpl = vi.fn();
    await expect(revokeStoredAppleToken(tableClient(null), 'user-1', { env: () => '', fetchImpl, log: quiet })).resolves.toBe('no_token');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('never throws, so the deletion goes on', async () => {
    const { pem } = await testKey();
    const env = { APPLE_TEAM_ID: 'T', APPLE_KEY_ID: 'K', APPLE_PRIVATE_KEY: pem };
    const down = async () => { throw new Error('network down'); };
    await expect(revokeStoredAppleToken(tableClient({ refresh_token: 'r' }), 'u', { env: (n) => env[n], fetchImpl: down, log: quiet })).resolves.toBe('failed');
    await expect(revokeStoredAppleToken(tableClient({ refresh_token: 'r' }), 'u', { env: () => '', fetchImpl: down, log: quiet })).resolves.toBe('not_configured');
    await expect(revokeStoredAppleToken(tableClient(null, { message: 'x' }), 'u', { env: () => '', fetchImpl: down, log: quiet })).resolves.toBe('failed');
  });
});
