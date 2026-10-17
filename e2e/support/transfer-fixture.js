import { randomBytes, randomUUID } from 'node:crypto';
import { createFakeSupabase } from './fake-supabase.js';

export const OWNER = { email: 'owner@example.com', name: 'Alex Keeper' };
export const RECIPIENT = { email: 'recipient@example.com', name: 'Riley Keeper', password: 'correct-horse-battery' };
export const GECKO_ID = 'fixture-mango';
export const PRIVATE_MESSAGE = 'Private seller handoff note';

// This is a browser contract fixture, not a substitute for the SQL security
// tests. It supplies the same redacted/authorized shapes to the real UI.
export function transferRpcHandlers() {
  const fail = (message) => { throw new Error(message); };
  const ownerOf = (db, transfer) => db.table('geckos').find((row) => row.id === transfer.animal_id);
  const stateOf = (row) => row.status === 'pending' && new Date(row.expires_at) < new Date() ? 'expired' : row.status;
  return {
    create_transfer(args, db) {
      const gecko = db.table('geckos').find((row) => row.id === args.p_animal_id);
      if (!db.currentUser || gecko?.created_by !== db.currentUser.email) fail('Only the owner can transfer this animal');
      const row = {
        id: randomUUID(), token: randomBytes(32).toString('hex'), animal_id: gecko.id,
        animal_type: args.p_animal_type || 'gecko', from_user_id: db.currentUser.id,
        created_by: db.currentUser.email, to_email: args.p_to_email || null,
        claim_mode: args.p_to_email ? 'email' : 'link', status: 'pending',
        sale_price: args.p_sale_price ?? null, message: args.p_message || null,
        expires_at: new Date(Date.now() + 72 * 3600_000).toISOString(), created_date: new Date().toISOString(),
      };
      db.table('transfer_requests').forEach((transfer) => {
        if (transfer.animal_id === row.animal_id && transfer.status === 'pending') transfer.status = 'cancelled';
      });
      db.table('transfer_requests').push(row);
      return { id: row.id, token: row.token, expires_at: row.expires_at, claim_mode: row.claim_mode, status: row.status };
    },
    get_transfer_preview({ p_token }, db) {
      const row = db.table('transfer_requests').find((transfer) => transfer.token === p_token);
      if (!row) return null;
      const gecko = ownerOf(db, row);
      const recipient = Boolean(db.currentUser?.email_confirmed_at && row.to_email === db.currentUser.email);
      const alreadyOwns = row.status === 'claimed' && row.to_user_id === db.currentUser?.id;
      const preview = {
        status: stateOf(row), expires_at: row.expires_at, claim_mode: row.claim_mode,
        recipient_authorized: recipient || alreadyOwns, claimed_by_you: alreadyOwns,
      };
      if (recipient || alreadyOwns) Object.assign(preview, {
        animal_id: row.animal_id, animal_type: row.animal_type, animal_name: gecko?.name,
        animal_subtitle: gecko?.morphs_traits, animal_image: gecko?.image_urls?.[0] || null,
        passport_code: gecko?.passport_code, message: row.message, sale_price: row.sale_price,
      });
      return preview;
    },
    claim_transfer({ p_token }, db) {
      const row = db.table('transfer_requests').find((transfer) => transfer.token === p_token);
      if (!row) fail('Transfer not found');
      if (!db.currentUser?.email_confirmed_at) fail('Sign in with a verified email');
      if (row.status === 'claimed') {
        if (row.to_user_id !== db.currentUser.id) fail('Transfer already claimed');
        return { ok: true, animal_id: row.animal_id, animal_type: row.animal_type, already_claimed: true };
      }
      if (stateOf(row) !== 'pending') fail(`Transfer ${stateOf(row)}`);
      if (row.from_user_id === db.currentUser.id) fail('You already own this animal');
      if (row.to_email && row.to_email !== db.currentUser.email) fail('You are not the intended recipient');
      const gecko = ownerOf(db, row);
      if (gecko?.created_by !== row.created_by) fail('The seller no longer owns this animal');
      row.status = 'claimed';
      row.to_user_id = db.currentUser.id;
      row.claimed_at = new Date().toISOString();
      gecko.created_by = db.currentUser.email;
      return { ok: true, animal_id: row.animal_id, animal_type: row.animal_type };
    },
    revoke_transfer({ p_transfer_id }, db) {
      const row = db.table('transfer_requests').find((transfer) => transfer.id === p_transfer_id);
      if (!row || row.from_user_id !== db.currentUser?.id) fail('Only the owner can revoke this transfer');
      if (row.status === 'pending') row.status = 'cancelled';
      return { ok: true };
    },
  };
}

export function createTransferFixture({ status = 'pending', mode = 'link', withTransfer = true } = {}) {
  const fake = createFakeSupabase({ rpc: transferRpcHandlers(), confirmOnPasswordSignIn: false });
  const owner = fake.addAccount(OWNER);
  const recipient = fake.addAccount(RECIPIENT);
  for (const profile of fake.table('profiles')) Object.assign(profile, {
    onboarding_completed_at: new Date().toISOString(), onboarding_role: 'breeder', keeper_mode: false,
  });
  const gecko = {
    id: GECKO_ID, name: 'Mango', created_by: owner.email,
    created_date: '2025-02-01T00:00:00.000Z', updated_date: '2026-10-01T00:00:00.000Z',
    sex: 'Female', morphs_traits: 'Lilly White Harlequin', hatch_date: '2024-08-12',
    weight_grams: 42.5, image_urls: [], archived: false, is_public: false,
    sire_name: 'Spud', dam_name: 'Harley', notes: 'Private collection note',
    passport_code: 'FIXTURE-MANGO',
  };
  fake.table('geckos').push(gecko);
  fake.table('weight_records').push({ id: 'weight-fixture', gecko_id: gecko.id, weight_grams: 42.5, record_date: '2026-10-01', created_by: owner.email });
  fake.table('feeding_records').push({ id: 'feeding-fixture', animal_id: gecko.id, animal_type: 'gecko', date: '2026-10-15', food_type: 'CGD', accepted: true, created_by: owner.email });
  const token = 'a'.repeat(64);
  const transfer = {
    id: '00000000-0000-4000-8000-000000000999', animal_id: gecko.id, animal_type: 'gecko',
    created_by: owner.email, from_user_id: owner.id, token, status,
    to_email: mode === 'email' ? recipient.email : null, claim_mode: mode,
    expires_at: new Date(Date.now() + (status === 'expired' ? -1 : 72) * 3600_000).toISOString(),
    message: PRIVATE_MESSAGE, sale_price: 250, created_date: new Date().toISOString(),
  };
  if (withTransfer) fake.table('transfer_requests').push(transfer);
  return { fake, owner, recipient, gecko, token, transfer };
}

export async function keepOffline(context) {
  await context.route(/^https?:\/\/(?!127\.0\.0\.1(?::|\/)|localhost(?::|\/)|e2e\.supabase\.test\/)/, (route) =>
    route.fulfill({ status: 204, body: '' }),
  );
}

export async function installFixture(context, fake, user) {
  await keepOffline(context);
  await fake.install(context);
  if (user) await fake.signIn(context, user);
}
