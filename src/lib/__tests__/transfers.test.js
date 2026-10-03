import { describe, expect, it, vi, beforeEach } from 'vitest';

const invoke = vi.fn();
vi.mock('@/lib/supabaseClient', () => ({ supabase: { functions: { invoke } } }));

const {
  animalFromPreview,
  buildTransferRow,
  claimUrlFor,
  effectiveTransferStatus,
  isValidEmail,
  parseSalePrice,
  sendTransferEmail,
  TRANSFER_TTL_HOURS,
} = await import('../transfers');
const { parentNameForSave } = await import('../parentNames');
const { inviteStatusMessage } = await import('../collectionInvite');
const { PUBLIC_WEIGHT_COLUMNS } = await import('../passportUtils');

describe('transfer form input', () => {
  it('checks the buyer email shape', () => {
    expect(isValidEmail(' buyer@example.com ')).toBe(true);
    expect(isValidEmail('buyer@example')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });

  it('reads the sale price box', () => {
    expect(parseSalePrice('')).toEqual({ ok: true, value: null });
    expect(parseSalePrice('  ')).toEqual({ ok: true, value: null });
    expect(parseSalePrice('$1,250')).toEqual({ ok: true, value: 1250 });
    expect(parseSalePrice('99.999')).toEqual({ ok: true, value: 100 });
    expect(parseSalePrice('-5')).toEqual({ ok: false });
    expect(parseSalePrice('a lot')).toEqual({ ok: false });
  });
});

describe('transfer rows', () => {
  it('builds the row the insert rule accepts', () => {
    const now = Date.UTC(2026, 9, 3, 12, 0, 0);
    const row = buildTransferRow({
      animalId: 'g1',
      userId: 'u1',
      userEmail: 'seller@example.com',
      toEmail: ' Buyer@Example.com ',
      salePrice: 250,
      message: '  Eating Pangea well  ',
      token: 'tok-123456',
      now,
    });
    expect(row).toEqual({
      animal_id: 'g1',
      animal_type: 'gecko',
      from_user_id: 'u1',
      to_email: 'buyer@example.com',
      token: 'tok-123456',
      sale_price: 250,
      message: 'Eating Pangea well',
      created_by: 'seller@example.com',
      expires_at: new Date(now + TRANSFER_TTL_HOURS * 3600 * 1000).toISOString(),
    });
  });

  it('stores an empty message as null and keeps the reptile type', () => {
    const row = buildTransferRow({ animalId: 'r1', animalType: 'other_reptile', userId: 'u', userEmail: 'e@x.co', toEmail: 'b@x.co', message: '   ', token: 't' });
    expect(row.message).toBeNull();
    expect(row.sale_price).toBeNull();
    expect(row.animal_type).toBe('other_reptile');
  });

  it('makes claim links on the given origin', () => {
    expect(claimUrlFor('abc', 'https://geckinspect.com')).toBe('https://geckinspect.com/claim/abc');
  });

  it('treats a pending transfer past its expiry as expired', () => {
    const now = new Date('2026-10-03T12:00:00Z');
    expect(effectiveTransferStatus({ status: 'pending', expires_at: '2026-10-03T11:00:00Z' }, now)).toBe('expired');
    expect(effectiveTransferStatus({ status: 'pending', expires_at: '2026-10-04T11:00:00Z' }, now)).toBe('pending');
    expect(effectiveTransferStatus({ status: 'claimed', expires_at: '2026-10-01T11:00:00Z' }, now)).toBe('claimed');
  });
});

describe('transfer email', () => {
  beforeEach(() => { invoke.mockReset(); });

  it('asks the server to mail the claim link by token only', async () => {
    invoke.mockResolvedValue({ data: { delivered: 1 }, error: null });
    await expect(sendTransferEmail('tok-1')).resolves.toEqual({ delivered: true });
    expect(invoke).toHaveBeenCalledWith('send-collection-invite', { body: { kind: 'transfer', token: 'tok-1' } });
  });

  it('never throws when the email does not go out', async () => {
    invoke.mockResolvedValue({ data: { delivered: 0, skipped: 'no-resend-key' }, error: null });
    expect(await sendTransferEmail('t')).toEqual({ delivered: false, reason: 'no-resend-key' });
    invoke.mockResolvedValue({ data: null, error: { message: 'forbidden' } });
    expect(await sendTransferEmail('t')).toEqual({ delivered: false, reason: 'forbidden' });
  });

  it('survives a network failure', async () => {
    invoke.mockImplementation(async () => { throw new Error('offline'); });
    expect(await sendTransferEmail('t')).toEqual({ delivered: false, reason: 'offline' });
  });
});

describe('claim page preview', () => {
  it('shows a private gecko by the name and photo from the preview', () => {
    const a = animalFromPreview({
      animal_type: 'gecko',
      animal_name: 'Mango',
      animal_subtitle: 'Lilly White Harlequin',
      animal_image: 'https://img.test/mango.jpg',
      passport_code: 'GI-2026-ABCD',
    });
    expect(a.name).toBe('Mango');
    expect(a.subtitle).toBe('Lilly White Harlequin');
    expect(a.image_urls).toEqual(['https://img.test/mango.jpg']);
    expect(a.passport_code).toBe('GI-2026-ABCD');
    expect(a.collectionPath).toBe('/MyGeckos');
  });

  it('never says Unknown', () => {
    expect(animalFromPreview({ animal_type: 'gecko' }).name).toBe('Your new gecko');
    const r = animalFromPreview({ animal_type: 'other_reptile', passport_code: 'X' });
    expect(r.name).toBe('Your new reptile');
    expect(r.passport_code).toBeNull();
    expect(r.collectionPath).toBe('/OtherReptiles');
  });
});

describe('parent names', () => {
  const parents = [{ id: 's1', name: 'Odin' }, { id: 'd1', name: 'Olivia' }];

  it('keeps the linked parent name instead of clearing it', () => {
    expect(parentNameForSave({ parentId: 's1', input: 'Odin (CG-001)', parents })).toBe('Odin');
  });

  it('keeps the stored name for a parent the keeper cannot see', () => {
    expect(parentNameForSave({ parentId: 'seller-sire', input: 'Odin', parents, storedName: 'Odin' })).toBe('Odin');
    expect(parentNameForSave({ parentId: 'seller-sire', input: 'Odin', parents })).toBe('Odin');
  });

  it('saves typed outside parents and blanks', () => {
    expect(parentNameForSave({ parentId: '', input: ' Altitude Exotics ', parents })).toBe('Altitude Exotics');
    expect(parentNameForSave({ parentId: '', input: '', parents })).toBeNull();
  });
});

describe('collection invite messages', () => {
  it('explains each closed state in plain words', () => {
    expect(inviteStatusMessage('expired')).toMatch(/expired/);
    expect(inviteStatusMessage('revoked')).toMatch(/withdrew/);
    expect(inviteStatusMessage('declined')).toMatch(/declined/);
    expect(inviteStatusMessage('accepted')).toMatch(/already been accepted/);
    expect(inviteStatusMessage('missing')).toMatch(/not valid/);
  });
});

describe('public passport weigh-ins', () => {
  it('never asks for the owner email column', () => {
    expect(PUBLIC_WEIGHT_COLUMNS).not.toMatch(/created_by/);
    expect(PUBLIC_WEIGHT_COLUMNS).toMatch(/weight_grams/);
    expect(PUBLIC_WEIGHT_COLUMNS).toMatch(/record_date/);
  });
});
