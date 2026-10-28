import { describe, expect, it, vi, beforeEach } from 'vitest';

const invoke = vi.fn();
const getUser = vi.fn();
const rpc = vi.fn();
const captureEvent = vi.fn();
vi.mock('@/lib/supabaseClient', () => ({ supabase: { functions: { invoke }, auth: { getUser }, rpc } }));
vi.mock('@/lib/posthog', () => ({ captureEvent: (...args) => captureEvent(...args) }));

const {
  startTransfer,
  cancelTransfer,
  animalFromPreview,
  buildTransferRow,
  claimErrorKind,
  claimUrlFor,
  claimViewState,
  effectiveTransferStatus,
  isValidEmail,
  parseSalePrice,
  requestPassportTransfer,
  sendTransferEmail,
  shouldOfferSoldTransfer,
  transferPriceDefault,
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

  it('uses the public website for QR links generated in a native app', () => {
    vi.stubGlobal('window', { location: { origin: 'capacitor://localhost' }, Capacitor: { isNativePlatform: () => true } });
    expect(claimUrlFor('native-token')).toBe('https://geckinspect.com/claim/native-token');
    vi.unstubAllGlobals();
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

describe('claim errors', () => {
  // Messages raised by claim_transfer() and the gecko limit trigger
  // (supabase/migrations/20261015120000_ownership_checks.sql).
  it('maps each server message to the page message', () => {
    expect(claimErrorKind({ message: 'already claimed' })).toBe('already_claimed');
    expect(claimErrorKind({ message: 'transfer cancelled' })).toBe('cancelled');
    expect(claimErrorKind({ message: 'transfer expired' })).toBe('expired');
    expect(claimErrorKind({ message: 'transfer not found' })).toBe('not_found');
    expect(claimErrorKind({ message: 'animal not found' })).toBe('not_found');
    expect(claimErrorKind({ message: 'not the intended recipient' })).toBe('wrong_account');
    expect(claimErrorKind({ message: 'the sender no longer owns this animal' })).toBe('seller_changed');
  });

  it('recognises a full plan by hint or by wording', () => {
    expect(claimErrorKind({ message: 'anything', hint: 'gecko_limit_reached' })).toBe('gecko_limit');
    expect(claimErrorKind({
      message: 'The Keeper plan holds up to 50 active geckos. Archive one you no longer keep, or upgrade your plan to add more.',
    })).toBe('gecko_limit');
  });

  it('falls back to a generic failure', () => {
    expect(claimErrorKind({ message: 'connection reset' })).toBe('claim_failed');
    expect(claimErrorKind(null)).toBe('claim_failed');
  });
});


describe('server-issued transfer links', () => {
  beforeEach(() => {
    getUser.mockReset(); rpc.mockReset(); invoke.mockReset();
    getUser.mockResolvedValue({ data: { user: { id: 'owner', email: 'owner@example.com' } } });
  });
  it('creates a scoped QR link on the server without emailing anyone', async () => {
    rpc.mockResolvedValue({ data: { id: 'transfer', token: 'opaque-token', expires_at: '2026-10-20T12:00:00Z', claim_mode: 'link' } });
    const result = await startTransfer({ animalId: 'g1', toEmail: null, salePrice: null, message: '  hello  ' });
    expect(rpc).toHaveBeenCalledWith('create_transfer', { p_animal_id: 'g1', p_animal_type: 'gecko', p_to_email: null, p_sale_price: null, p_message: 'hello' });
    expect(result.claimUrl).toMatch(/\/claim\/opaque-token$/);
    expect(invoke).not.toHaveBeenCalled();
  });
  it('emails only after the authenticated create succeeds', async () => {
    rpc.mockResolvedValue({ error: { message: 'Only the owner can transfer it.' } });
    await expect(startTransfer({ animalId: 'someone-elses-gecko', toEmail: 'buyer@example.com' })).rejects.toMatchObject({ message: 'Only the owner can transfer it.' });
    expect(invoke).not.toHaveBeenCalled();
  });
  it('requires a session before starting a transfer', async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    await expect(startTransfer({ animalId: 'g1' })).rejects.toThrow('signed in');
    expect(rpc).not.toHaveBeenCalled();
  });
  it('fails clearly without a browser fallback when the server is not ready', async () => {
    rpc.mockResolvedValue({ error: { code: 'PGRST202', message: 'Could not find create_transfer' } });
    await expect(startTransfer({ animalId: 'g1' })).rejects.toThrow('temporarily unavailable');
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(invoke).not.toHaveBeenCalled();
  });
  it('revokes through the owner-checked server operation', async () => {
    rpc.mockResolvedValue({ data: { status: 'cancelled' } });
    await cancelTransfer('transfer');
    expect(rpc).toHaveBeenCalledWith('revoke_transfer', { p_transfer_id: 'transfer' });
  });
  it('maps verification and self-transfer failures', () => {
    expect(claimErrorKind({ message: 'verified email required' })).toBe('verify_email');
    expect(claimErrorKind({ message: 'cannot transfer to yourself' })).toBe('own_animal');
    expect(claimErrorKind({ message: 'not authenticated' })).toBe('sign_in');
  });
});

describe('the transfer form price', () => {
  it('starts with the sold price, then the asking price, then blank', () => {
    expect(transferPriceDefault({ sold_price: 300, asking_price: 450 })).toBe('300');
    expect(transferPriceDefault({ sold_price: null, asking_price: 450 })).toBe('450');
    expect(transferPriceDefault({ sold_price: '', asking_price: '125.5' })).toBe('125.5');
    expect(transferPriceDefault({ sold_price: 0 })).toBe('0');
    expect(transferPriceDefault({ asking_price: 'call me' })).toBe('');
    expect(transferPriceDefault({ asking_price: -5 })).toBe('');
    expect(transferPriceDefault(null)).toBe('');
  });
});

describe('offering the transfer after a sale', () => {
  const owner = { email: 'Seller@Example.com' };
  const gecko = { id: 'g1', name: 'Mango', created_by: 'seller@example.com' };

  it('offers it to the owner when a gecko is archived as sold', () => {
    expect(shouldOfferSoldTransfer({ gecko, user: owner, reason: 'sold' })).toBe(true);
  });

  it('never offers it for another reason, to a collection editor, or in the demo', () => {
    expect(shouldOfferSoldTransfer({ gecko, user: owner, reason: 'death' })).toBe(false);
    expect(shouldOfferSoldTransfer({ gecko, user: owner, reason: 'other' })).toBe(false);
    expect(shouldOfferSoldTransfer({ gecko, user: { email: 'editor@example.com' }, reason: 'sold' })).toBe(false);
    expect(shouldOfferSoldTransfer({ gecko, user: owner, reason: 'sold', guest: true })).toBe(false);
    expect(shouldOfferSoldTransfer({ gecko, user: { ...owner, is_guest: true }, reason: 'sold' })).toBe(false);
    expect(shouldOfferSoldTransfer({ gecko: null, user: owner, reason: 'sold' })).toBe(false);
    expect(shouldOfferSoldTransfer({ gecko, user: null, reason: 'sold' })).toBe(false);
  });
});

describe('what a claim link shows', () => {
  const now = new Date('2026-10-28T02:00:00Z');
  it('names each state the claim page handles', () => {
    expect(claimViewState({ status: 'pending', expires_at: '2026-10-29T00:00:00Z' }, now)).toBe('open');
    expect(claimViewState({ status: 'pending', expires_at: '2026-10-27T00:00:00Z' }, now)).toBe('expired');
    expect(claimViewState({ status: 'expired' }, now)).toBe('expired');
    expect(claimViewState({ status: 'cancelled' }, now)).toBe('cancelled');
    expect(claimViewState({ status: 'claimed' }, now)).toBe('already_claimed');
    expect(claimViewState({ status: 'claimed', claimed_by_you: true }, now)).toBe('claimed_by_you');
  });
});

describe('passport and transfer funnel events', () => {
  beforeEach(() => {
    getUser.mockReset(); rpc.mockReset(); invoke.mockReset(); captureEvent.mockReset();
    getUser.mockResolvedValue({ data: { user: { id: 'owner', email: 'owner@example.com' } } });
  });

  it('records a QR transfer with its method, price flag and surface only', async () => {
    rpc.mockResolvedValue({ data: { id: 't1', token: 'opaque-token', claim_mode: 'link' } });
    await startTransfer({ animalId: 'g1', toEmail: null, salePrice: 300, message: 'Eating Pangea well', surface: 'sold_step' });
    expect(captureEvent).toHaveBeenCalledWith('transfer_started', {
      method: 'link', has_price: true, animal_type: 'gecko', surface: 'sold_step',
    });
  });

  it('records an emailed transfer without the address, price or message', async () => {
    rpc.mockResolvedValue({ data: { id: 't2', token: 'opaque-token', claim_mode: 'email' } });
    invoke.mockResolvedValue({ data: { delivered: 1 }, error: null });
    await startTransfer({ animalId: 'g1', toEmail: 'Buyer@Example.com', salePrice: null, message: 'Private note' });
    const [name, props] = captureEvent.mock.calls[0];
    expect(name).toBe('transfer_started');
    expect(props).toEqual({ method: 'email', has_price: false, animal_type: 'gecko', surface: 'record', emailed: true });
    expect(JSON.stringify(props)).not.toMatch(/buyer|example|Private|opaque|g1/i);
  });

  it('records nothing when the transfer was not made', async () => {
    rpc.mockResolvedValue({ error: { message: 'Only the owner can transfer it.' } });
    await expect(startTransfer({ animalId: 'g1' })).rejects.toThrow();
    expect(captureEvent).not.toHaveBeenCalled();
  });

  it('records the outcome of a buyer asking for a transfer, without the passport code', async () => {
    rpc.mockResolvedValue({ data: { status: 'sent' }, error: null });
    await expect(requestPassportTransfer('GI-2026-ABCD')).resolves.toEqual({ status: 'sent' });
    rpc.mockResolvedValue({ data: { status: 'already_requested' }, error: null });
    await requestPassportTransfer('GI-2026-ABCD');
    rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } });
    await requestPassportTransfer('GI-2026-ABCD');
    expect(captureEvent.mock.calls).toEqual([
      ['passport_transfer_requested', { outcome: 'sent' }],
      ['passport_transfer_requested', { outcome: 'already_requested' }],
      ['passport_transfer_requested', { outcome: 'unavailable' }],
    ]);
  });
});
