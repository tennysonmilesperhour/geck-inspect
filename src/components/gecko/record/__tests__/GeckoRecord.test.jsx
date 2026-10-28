import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isPageRetired } from '@/lib/retiredPages';

// Shared state the mocks read and write.
const state = vi.hoisted(() => ({
  weights: [],
  events: [],
  plans: { sire: [], dam: [] },
  eggs: [],
  offspring: [],
  geckosById: {},
  owner: null,
  publicRows: [],
  publicSheds: [],
  toasts: [],
  created: [],
  updates: [],
  deleted: [],
  failCreate: false,
  loaded: { certificates: false, packet: false },
  certificateCalls: [],
}));

// Plain stand-ins for the UI kit: Radix needs a browser, and these keep
// the props that matter (text, clicks, open state).
vi.mock('@/lib/utils', () => ({ cn: (...parts) => parts.filter(Boolean).join(' ') }));
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, asChild, onClick, disabled, type, title, ...rest }) =>
    asChild ? children : <button type={type || 'button'} onClick={onClick} disabled={disabled} title={title} aria-label={rest['aria-label']}>{children}</button>,
}));
vi.mock('@/components/ui/badge', () => ({ Badge: ({ children }) => <span>{children}</span> }));
vi.mock('@/components/ui/input', () => ({ Input: (props) => <input {...props} /> }));
vi.mock('@/components/ui/label', () => ({ Label: ({ children, htmlFor }) => <label htmlFor={htmlFor}>{children}</label> }));
vi.mock('@/components/ui/switch', () => ({
  Switch: ({ id, checked, onCheckedChange }) => <input type="checkbox" id={id} checked={checked} onChange={(e) => onCheckedChange(e.target.checked)} />,
}));
vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ open, children }) => (open === false ? null : <div>{children}</div>),
  AlertDialogTrigger: ({ children }) => children,
  AlertDialogContent: ({ children }) => <div data-confirm>{children}</div>,
  AlertDialogHeader: ({ children }) => <div>{children}</div>,
  AlertDialogFooter: ({ children }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }) => <h2>{children}</h2>,
  AlertDialogDescription: ({ children }) => <p>{children}</p>,
  AlertDialogCancel: ({ children }) => <button type="button">{children}</button>,
  AlertDialogAction: ({ children, onClick }) => <button type="button" data-confirm-action onClick={onClick}>{children}</button>,
}));
vi.mock('@/components/ui/use-toast', () => ({ toast: (t) => state.toasts.push(t) }));
vi.mock('react-router-dom', () => ({ Link: ({ children, to }) => <a href={typeof to === 'string' ? to : to?.pathname}>{children}</a> }));
vi.mock('@/api/appClient', () => ({ api: { auth: { redirectToLogin: vi.fn() } } }));
vi.mock('@/lib/guestMode', () => ({ isGuestMode: () => false }));

// Pieces with their own data or tests: stubs that show they are there.
const stub = vi.hoisted(() => (label) => () => ({
  default: (props) => <div data-stub={label}>{label}{props?.gecko?.name ? ` for ${props.gecko.name}` : ''}</div>,
}));
vi.mock('@/components/gecko/MarketValueCard', stub('Estimated value'));
vi.mock('@/components/gecko/HusbandryHistory', stub('Feeding and shed log'));
vi.mock('@/components/gecko/VetRecordsSection', () => ({
  default: ({ canEdit }) => <div data-stub="Vet visits">Vet visits{canEdit ? ' (can add)' : ' (read only)'}</div>,
}));
vi.mock('@/components/gecko/WeighInReminderSwitch', stub('Weigh-in reminder'));
vi.mock('@/components/shared/WeightChart', stub('Growth chart'));
vi.mock('@/components/my-geckos/EventTracker', stub('+ Event'));
vi.mock('@/components/settings/CollectionActivity', () => ({ default: () => null }));
vi.mock('@/components/ui/MessageUserButton', stub('Message the breeder'));
vi.mock('@/components/support/ReportContent', stub('Report'));
vi.mock('@/components/shared/ShareMenu', stub('Share'));
vi.mock('@/components/store/StickerGeckoActions', stub('Make a sticker'));
vi.mock('@/components/store/RecommendedKitForGecko', stub('Supplies'));
vi.mock('@/components/gecko/HiddenHetPanel', stub('Hidden genetics'));
vi.mock('@/components/health/HealthScreenCard', stub('Health check'));
vi.mock('@/components/gecko/GrowthReel', stub('Growth reel'));
vi.mock('@/components/gecko/VisualSiblings', stub('Lookalikes'));
vi.mock('@/components/transfers/TransferDialog', stub('Transfer dialog'));
vi.mock('@/components/breeding/BreedingReadiness', () => ({ ReadinessCard: () => <div data-stub="Readiness">Readiness</div> }));
vi.mock('@/components/shared/SmartImage', () => ({ default: ({ alt }) => <img alt={alt} /> }));
vi.mock('@/components/shared/GeckoImage', () => ({ default: ({ alt }) => <img alt={alt} /> }));

// The PDF builders: the factories record when the module is first loaded,
// so the test can show they load on the tap, not with the record.
vi.mock('@/lib/certificateUtils', () => {
  state.loaded.certificates = true;
  return {
    generateOwnershipCertificatePDF: vi.fn(async (...args) => { state.certificateCalls.push(['ownership', ...args]); }),
    generateLineageCertificatePDF: vi.fn(async (arg) => { state.certificateCalls.push(['lineage', arg]); }),
  };
});
vi.mock('@/lib/buyerPacket', () => {
  state.loaded.packet = true;
  return { buildBuyerPacket: vi.fn(() => ({})), renderBuyerPacketPDF: vi.fn(async () => ({})), packetFilename: () => 'x.pdf' };
});
vi.mock('@/lib/buyerPacketAssets', () => ({ photoDataUrl: async () => null, qrDataUrl: async () => null, downloadPdf: vi.fn() }));

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: (table) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        order: async () => ({
          data: table === 'weight_records' ? state.publicRows : table === 'shed_records' ? state.publicSheds : [],
          error: null,
        }),
      };
      return chain;
    },
  },
}));
vi.mock('@/entities/all', () => ({
  WeightRecord: {
    filter: vi.fn(async () => state.weights),
    create: vi.fn(async (row) => {
      if (state.failCreate) throw new Error('offline');
      state.created.push(row);
      return { id: `w${state.created.length}`, ...row };
    }),
    delete: vi.fn(async (id) => { state.deleted.push(['weight', id]); }),
  },
  ShedRecord: { filter: vi.fn(async () => []) },
  GeckoEvent: { filter: vi.fn(async () => state.events) },
  BreedingPlan: {
    filter: vi.fn(async (f) => (f.sire_id ? state.plans.sire : state.plans.dam)),
    update: vi.fn(async (id, fields) => { state.updates.push(['plan', id, fields]); }),
  },
  Egg: { filter: vi.fn(async () => state.eggs) },
  Gecko: {
    get: vi.fn(async (id) => state.geckosById[id] || null),
    filter: vi.fn(async (f) => {
      if (f.id?.$in) return f.id.$in.map((id) => state.geckosById[id]).filter(Boolean);
      return state.offspring.filter((g) => (f.sire_id && g.sire_id === f.sire_id) || (f.dam_id && g.dam_id === f.dam_id));
    }),
    update: vi.fn(async (id, fields) => { state.updates.push(['gecko', id, fields]); }),
  },
  User: { get: vi.fn(async () => state.owner), filter: vi.fn(async () => (state.owner ? [state.owner] : [])) },
  FeedingRecord: { filter: vi.fn(async () => []) },
  FeedingGroup: { filter: vi.fn(async () => []) },
  GeckoImage: { filter: vi.fn(async () => []), create: vi.fn(), delete: vi.fn() },
  CollectionMember: { filter: vi.fn(async () => []) },
}));

const { default: GeckoRecord } = await import('../GeckoRecord');

const OWNER = { id: 'u1', email: 'keeper@example.com', full_name: 'Tess Keeper' };
const EDITOR = { id: 'u2', email: 'editor@example.com' };
const SPUD = { id: 'sire-1', name: 'Spud', sex: 'Male' };
const HARLEY = { id: 'dam-1', name: 'Harley', sex: 'Female' };
const NIMBUS = {
  id: 'g1',
  name: 'Nimbus',
  sex: 'Male',
  status: 'Holdback',
  created_by: 'keeper@example.com',
  collection_id: 'c1',
  sire_id: 'sire-1',
  dam_id: 'dam-1',
  hatch_date: '2025-06-01',
  morphs_traits: 'Lilly White, Harlequin',
  weight_grams: 30,
  passport_code: null,
  is_public: true,
  image_urls: ['https://example.com/nimbus.jpg'],
};

// Document-order walk of the rendered tree.
function walk(node, visit) {
  if (!node || typeof node === 'string') return;
  if (Array.isArray(node)) { node.forEach((n) => walk(n, visit)); return; }
  visit(node);
  (node.children || []).forEach((c) => walk(c, visit));
}
const innerText = (node) => (typeof node === 'string' ? node : (node?.children || []).map(innerText).join(''));
const textOf = (tree) => innerText({ children: [].concat(tree.toJSON() || []) });
const buttons = (tree, text) => tree.root.findAll((n) => n.type === 'button' && innerText(n).includes(text));
const hasButton = (tree, text) => buttons(tree, text).length > 0;
function markers(tree) {
  const out = [];
  walk(tree.toJSON(), (n) => {
    const m = n.props?.['data-record-section'] || n.props?.['data-stub'] || (n.props?.['data-record-offers'] !== undefined ? 'offers' : null);
    if (m) out.push(m);
  });
  return out;
}

async function mount(props = {}) {
  let tree;
  await act(async () => {
    tree = create(
      <GeckoRecord
        gecko={NIMBUS}
        currentUser={OWNER}
        canEdit
        isMember
        allGeckos={[SPUD, HARLEY]}
        onEdit={vi.fn()}
        onArchive={vi.fn()}
        onDelete={vi.fn()}
        onUpdate={vi.fn()}
        {...props}
      />,
    );
  });
  // Let the parallel loads and the lazily loaded pieces settle.
  for (let i = 0; i < 6; i += 1) {
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  }
  return tree;
}

beforeEach(() => {
  state.weights = [
    { id: 'w-old', gecko_id: 'g1', record_date: '2026-08-01', weight_grams: 28 },
    { id: 'w-new', gecko_id: 'g1', record_date: '2026-10-01', weight_grams: 33 },
  ];
  state.events = [{ id: 'e1', event_type: 'cage_cleaning', event_date: '2026-10-02T10:00:00' }];
  state.plans = { sire: [{ id: 'p1', sire_id: 'g1', dam_id: 'mate-1', status: 'Active', is_public: false }], dam: [] };
  state.eggs = [];
  state.offspring = [];
  state.geckosById = { 'mate-1': { id: 'mate-1', name: 'Mango' } };
  state.owner = { id: 'u1', full_name: 'Tess Keeper', email: 'keeper@example.com' };
  state.publicRows = [];
  state.publicSheds = [];
  state.toasts.length = 0;
  state.created.length = 0;
  state.updates.length = 0;
  state.deleted.length = 0;
  state.failCreate = false;
  state.certificateCalls.length = 0;
});

describe('the gecko record, for its owner', () => {
  it('holds every part of the history in one place', async () => {
    const tree = await mount();
    const text = textOf(tree);
    for (const part of ['Parents', 'Spud', 'Harley', 'Estimated value for Nimbus', 'Weights', 'Now 33 g', 'Growth chart',
      'Feeding and shed log', 'Vet visits (can add)', 'Passport and papers', 'Make a passport', 'Breeding', 'Event history',
      'Cage cleaning', 'Hidden genetics', 'Health check', 'Make a sticker']) {
      expect(text, part).toContain(part);
    }
  });

  it('links to each section from the top, and every link has its section', async () => {
    const tree = await mount();
    const links = tree.root.findAll((n) => n.type === 'a' && String(n.props.href || '').startsWith('#record-'));
    expect(links.map((a) => innerText(a))).toEqual(['Overview', 'Care history', 'Breeding', 'Sharing', 'More']);
    const ids = new Set(tree.root.findAll((n) => typeof n.props?.id === 'string').map((n) => n.props.id));
    for (const a of links) expect(ids.has(a.props.href.slice(1)), a.props.href).toBe(true);
  });

  it('puts the parents and the value above the weights, and the sticker offer last', async () => {
    const order = markers(await mount());
    const at = (m) => order.indexOf(m);
    expect(at('family')).toBeGreaterThanOrEqual(0);
    expect(at('family')).toBeLessThan(at('weights'));
    expect(at('Estimated value')).toBeLessThan(at('weights'));
    expect(at('weights')).toBeLessThan(at('passport'));
    expect(at('manage')).toBeLessThan(at('Make a sticker'));
    // The supplies picks show only while the store is live; it was retired
    // on 16 Oct 2026, so the sticker offer is last.
    if (isPageRetired('Store')) {
      expect(order).not.toContain('Supplies');
      expect(order.at(-1)).toBe('Make a sticker');
    } else {
      expect(order.at(-1)).toBe('Supplies');
      expect(at('Make a sticker')).toBe(order.length - 2);
    }
  });

  it('groups care records together and keeps transfer and housekeeping in sharing', async () => {
    const tree = await mount();
    const care = tree.root.find((n) => n.type === 'section' && n.props.id === 'record-care-history');
    const sharing = tree.root.find((n) => n.type === 'section' && n.props.id === 'record-sharing');
    for (const label of ['Weights', 'Feeding and sheds', 'Vet visits', 'Event history']) {
      expect(innerText(care), label).toContain(label);
    }
    expect(innerText(care)).not.toContain('Transfer to a new owner');
    expect(innerText(sharing)).toContain('Transfer to a new owner');
    expect(innerText(sharing)).toContain('Archive');
    expect(innerText(sharing)).not.toContain('Feeding and shed log');
  });

  it('names the pairing partner even when the host does not have it', async () => {
    const tree = await mount({ allGeckos: [SPUD, HARLEY] });
    expect(textOf(tree)).toContain('Paired with Mango');
  });

  // The weigh-in form saves a day after today as today (a future date is a
  // typo), so a 10 Oct weigh-in keeps its date only once the clock has
  // reached it. The clock is fixed so the test does not depend on the day
  // it runs.
  it('logs a weigh-in and makes the newest one the gecko weight', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-16T12:00:00.000Z'));
    try {
      const onUpdate = vi.fn();
      const tree = await mount({ onUpdate });
      const grams = tree.root.find((n) => n.props.id === 'record-weight-grams');
      const day = tree.root.find((n) => n.props.id === 'record-weight-date');
      await act(async () => { grams.props.onChange({ target: { value: '35.5' } }); });
      await act(async () => { day.props.onChange({ target: { value: '2026-10-10' } }); });
      await act(async () => { tree.root.find((n) => n.type === 'form').props.onSubmit({ preventDefault() {} }); });
      expect(state.created).toEqual([{ gecko_id: 'g1', weight_grams: 35.5, record_date: '2026-10-10' }]);
      expect(state.updates).toContainEqual(['gecko', 'g1', { weight_grams: 35.5 }]);
      expect(onUpdate).toHaveBeenCalled();
      expect(textOf(tree)).toContain('Now 35.5 g');
    } finally {
      vi.useRealTimers();
    }
  });

  it('a backdated weigh-in is saved without changing the current weight', async () => {
    const tree = await mount();
    await act(async () => { tree.root.find((n) => n.props.id === 'record-weight-grams').props.onChange({ target: { value: '25' } }); });
    await act(async () => { tree.root.find((n) => n.props.id === 'record-weight-date').props.onChange({ target: { value: '2026-07-01' } }); });
    await act(async () => { tree.root.find((n) => n.type === 'form').props.onSubmit({ preventDefault() {} }); });
    expect(state.created).toHaveLength(1);
    expect(state.updates.filter(([kind]) => kind === 'gecko')).toHaveLength(0);
  });

  it('keeps what was typed when a weigh-in fails to save', async () => {
    state.failCreate = true;
    const tree = await mount();
    await act(async () => { tree.root.find((n) => n.props.id === 'record-weight-grams').props.onChange({ target: { value: '34' } }); });
    await act(async () => { tree.root.find((n) => n.type === 'form').props.onSubmit({ preventDefault() {} }); });
    expect(state.toasts.at(-1).title).toBe('Weigh-in not saved');
    expect(tree.root.find((n) => n.props.id === 'record-weight-grams').props.value).toBe('34');
  });

  it('asks for a number instead of saving a blank weigh-in', async () => {
    const tree = await mount();
    await act(async () => { tree.root.find((n) => n.type === 'form').props.onSubmit({ preventDefault() {} }); });
    expect(state.created).toHaveLength(0);
    expect(textOf(tree)).toContain('Enter the weight in grams');
  });

  it('loads the PDF code only when a paper is asked for', async () => {
    const tree = await mount();
    expect(state.loaded.certificates).toBe(false);
    expect(state.loaded.packet).toBe(false);
    await act(async () => { buttons(tree, 'Lineage certificate')[0].props.onClick(); });
    await act(async () => { await vi.waitFor(() => expect(state.certificateCalls).toHaveLength(1)); });
    expect(state.loaded.certificates).toBe(true);
    expect(state.loaded.packet).toBe(false);
    const [kind, arg] = state.certificateCalls[0];
    expect(kind).toBe('lineage');
    expect(arg.gecko.id).toBe('g1');
    expect(arg.sire.name).toBe('Spud');
    expect(arg.dam.name).toBe('Harley');
    expect(state.toasts.at(-1).title).toBe('Certificate downloaded');
  });

  it('makes a passport and turns Public display on with it', async () => {
    const onUpdate = vi.fn();
    const tree = await mount({ onUpdate });
    await act(async () => { buttons(tree, 'Make a passport')[0].props.onClick(); });
    const update = state.updates.find(([kind]) => kind === 'gecko');
    expect(update[2]).toMatchObject({ is_public: true });
    expect(update[2].passport_code).toMatch(/\S/);
    expect(onUpdate).toHaveBeenCalled();
    expect(textOf(tree)).toContain('View passport');
  });

  it('shows the owner transfer, archive and edit, and delete once archived', async () => {
    const live = await mount();
    expect(hasButton(live, 'Transfer to a new owner')).toBe(true);
    expect(hasButton(live, 'Archive')).toBe(true);
    expect(hasButton(live, 'Delete for good')).toBe(false);
    expect(live.root.findAll((n) => n.type === 'button' && n.props['aria-label'] === 'Edit Nimbus')).toHaveLength(1);

    const onDelete = vi.fn();
    const archived = await mount({ gecko: { ...NIMBUS, archived: true, archive_reason: 'other' }, onDelete });
    expect(hasButton(archived, 'Unarchive')).toBe(true);
    const confirm = archived.root.findAll((n) => n.type === 'button' && n.props['data-confirm-action'] !== undefined && innerText(n).includes('Delete for good'));
    expect(confirm).toHaveLength(1);
    // The confirmation names everything the database removes with the
    // gecko: its feeding, shed and vet records and its ownership history
    // cascade with it, and a trigger removes its weigh-ins.
    expect(textOf(archived)).toContain(
      'permanently removes Nimbus and every weigh-in, feeding, shed, vet visit and ownership record logged for it.',
    );
    await act(async () => { confirm[0].props.onClick(); });
    expect(onDelete).toHaveBeenCalledWith('g1');
  });
});

describe('who sees which actions', () => {
  it('a collection editor can log, edit and archive, but not delete, transfer or see the value', async () => {
    const tree = await mount({ currentUser: EDITOR, gecko: { ...NIMBUS, archived: true, archive_reason: 'other' } });
    const text = textOf(tree);
    expect(tree.root.findAll((n) => n.type === 'input' && n.props.id === 'record-weight-grams')).toHaveLength(1);
    expect(hasButton(tree, 'Unarchive')).toBe(true);
    expect(tree.root.findAll((n) => n.type === 'button' && n.props['aria-label'] === 'Edit Nimbus')).toHaveLength(1);
    expect(hasButton(tree, 'Delete for good')).toBe(false);
    expect(hasButton(tree, 'Transfer to a new owner')).toBe(false);
    expect(text).not.toContain('Estimated value');
    expect(text).toContain('Vet visits (can add)');
  });

  it('a read-only member sees the care history and nothing to change', async () => {
    const tree = await mount({ currentUser: EDITOR, canEdit: false });
    const text = textOf(tree);
    expect(text).toContain('Read-only');
    expect(text).toContain('Feeding and shed log');
    expect(text).toContain('Vet visits (read only)');
    expect(tree.root.findAll((n) => n.type === 'input' && n.props.id === 'record-weight-grams')).toHaveLength(0);
    for (const label of ['Archive', 'Delete for good', 'Transfer to a new owner', 'Make a passport', 'Ownership certificate']) {
      expect(hasButton(tree, label), label).toBe(false);
    }
    expect(text).not.toContain('+ Event');
    expect(text).not.toContain('Make a sticker');
  });

  it('a visitor sees the public record, the breeder and the price, and no keeper tools', async () => {
    state.publicRows = [{ id: 'w1', record_date: '2026-10-01', weight_grams: 33 }];
    // The page has no collection in memory, so the parents are fetched.
    state.geckosById = { 'sire-1': SPUD, 'dam-1': HARLEY };
    const visitorGecko = { ...NIMBUS, created_by: undefined, owner_profile_id: 'u1', asking_price: 450, passport_code: 'GI-2026-ABCD' };
    const tree = await mount({ gecko: visitorGecko, currentUser: null, canEdit: false, isMember: false, allGeckos: [] });
    // The visitor card is its own file, loaded only for visitors; the
    // first load in a test run includes compiling it.
    await vi.waitFor(async () => {
      await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
      expect(textOf(tree)).toContain('Asking price');
    }, { timeout: 4000 });
    const text = textOf(tree);
    expect(text).toContain('Spud');
    expect(text).toContain('Asking price');
    expect(text).toContain('$450');
    expect(text).toContain('Tess Keeper');
    expect(text).toContain('Growth chart');
    expect(text).toContain('View passport');
    for (const hidden of ['Estimated value', 'Feeding and shed log', 'Vet visits', 'Event history', 'Make a sticker', 'Read-only', '+ Event']) {
      expect(text, hidden).not.toContain(hidden);
    }
    for (const label of ['Archive', 'Delete for good', 'Transfer to a new owner', 'Ownership certificate', 'Save']) {
      expect(hasButton(tree, label), label).toBe(false);
    }
    expect(tree.root.findAll((n) => n.type === 'button' && n.props['aria-label'] === 'Edit Nimbus')).toHaveLength(0);
  });

  it('a visitor\'s shed estimate reads the record\'s weight when there are no weigh-ins', async () => {
    // An adult with a weight on its record, no hatch date and no weigh-ins
    // used to get the juvenile 2 to 3 week cycle.
    state.publicSheds = [{ date: '2026-10-10' }];
    state.geckosById = { 'sire-1': SPUD, 'dam-1': HARLEY };
    const adult = { ...NIMBUS, created_by: undefined, owner_profile_id: 'u1', hatch_date: null, weight_grams: 48 };
    const tree = await mount({ gecko: adult, currentUser: null, canEdit: false, isMember: false, allGeckos: [] });
    await vi.waitFor(async () => {
      await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
      expect(textOf(tree)).toContain('recorded shed');
    }, { timeout: 4000 });
    expect(textOf(tree)).toContain('typical adult cycle (every 4 to 6 weeks)');
  });

  it('every jump link lands on a section, whoever is looking', async () => {
    state.weights = [];
    state.geckosById = { 'sire-1': SPUD, 'dam-1': HARLEY };
    const viewers = [
      { currentUser: OWNER },
      { currentUser: EDITOR },
      { currentUser: EDITOR, canEdit: false },
      { currentUser: null, canEdit: false, isMember: false, allGeckos: [], gecko: { ...NIMBUS, created_by: undefined } },
    ];
    for (const props of viewers) {
      const tree = await mount(props);
      const links = tree.root.findAll((n) => n.type === 'a' && String(n.props.href || '').startsWith('#record-'));
      const ids = new Set(tree.root.findAll((n) => typeof n.type === 'string' && typeof n.props.id === 'string').map((n) => n.props.id));
      expect(links.length).toBeGreaterThan(0);
      for (const a of links) expect(ids.has(a.props.href.slice(1)), `${a.props.href} for ${props.currentUser?.email || 'a visitor'}`).toBe(true);
    }
  });

  // A gecko that died is marked "In memory" in the record as on its card
  // (ArchiveStatusChip), and the record says "Passed away" like the
  // archive dialog and the edit form.
  it('marks an archived gecko with its reason in words, "In memory" for a death', async () => {
    const died = await mount({ gecko: { ...NIMBUS, archived: true, archive_reason: 'death' } });
    const text = textOf(died);
    expect(text).toContain('In memory');
    expect(text).toContain('Passed away');
    expect(text).not.toContain('Passed Away');
    expect(hasButton(died, 'Passed away')).toBe(true);

    expect(textOf(await mount({ gecko: { ...NIMBUS, archived: true, archive_reason: 'sold' } }))).toContain('Sold');
    const other = textOf(await mount({ gecko: { ...NIMBUS, archived: true, archive_reason: null } }));
    expect(other).toContain('Archived');
    expect(other).not.toContain('In memory');
    expect(textOf(await mount())).not.toContain('In memory');
  });

  it('a host without a flow shows no button for it', async () => {
    const tree = await mount({ onEdit: undefined, onArchive: undefined, onDelete: undefined, gecko: { ...NIMBUS, archived: true } });
    expect(tree.root.findAll((n) => n.type === 'button' && n.props['aria-label'] === 'Edit Nimbus')).toHaveLength(0);
    expect(hasButton(tree, 'Unarchive')).toBe(false);
    expect(hasButton(tree, 'Delete for good')).toBe(false);
  });
});

describe('the empty weight panel', () => {
  it('suggests the same weigh-in rhythm as the reminders and the care guide', async () => {
    // It said "every two to four weeks", against the care guide's every 1
    // to 2 weeks while growing and the 14-day reminder.
    state.weights = [];
    let tree = await mount({ gecko: { ...NIMBUS, hatch_date: null, weight_grams: null } });
    expect(textOf(tree)).toContain('No weigh-ins yet. Weigh Nimbus every 2 weeks while growing to keep track of its weight.');
    tree = await mount({ gecko: { ...NIMBUS, hatch_date: null, weight_grams: 48 } });
    expect(textOf(tree)).toContain('Weigh Nimbus once a month as an adult');
    expect(textOf(tree)).not.toMatch(/two to four weeks/);
  });
});
