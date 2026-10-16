import fs from 'node:fs';
import path from 'node:path';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  gecko: null,
  user: null,
  memberships: [],
  navigations: [],
  updates: [],
  deletes: [],
  invalidated: [],
  events: [],
  toasts: [],
  failUpdate: null,
  lastRecordProps: null,
  locationKey: 'abc',
}));

// The record itself is tested in GeckoRecord.test.jsx; here a stand-in
// captures what each host hands it.
vi.mock('@/components/gecko/record/GeckoRecord', () => ({
  default: (props) => {
    state.lastRecordProps = props;
    return <div data-record={props.variant}>{props.leading}{props.gecko?.name}</div>;
  },
}));
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, asChild, onClick, ...rest }) =>
    asChild ? children : <button type="button" onClick={onClick} aria-label={rest['aria-label']}>{children}</button>,
}));
vi.mock('@/components/ui/use-toast', () => ({ toast: (t) => state.toasts.push(t) }));
vi.mock('react-router-dom', () => ({
  Link: ({ children, to }) => <a href={to}>{children}</a>,
  useNavigate: () => (to, opts) => state.navigations.push([to, opts]),
  useLocation: () => ({ search: '?id=g1', key: state.locationKey, pathname: '/GeckoDetail' }),
}));
vi.mock('@/api/appClient', () => ({
  api: { auth: { me: vi.fn(async () => { if (!state.user) throw new Error('signed out'); return state.user; }) } },
}));
vi.mock('@/lib/query-client', () => ({
  queryClientInstance: { invalidateQueries: (q) => state.invalidated.push(q.queryKey) },
}));
vi.mock('@/entities/all', () => ({
  Gecko: {
    get: vi.fn(async () => state.gecko),
    update: vi.fn(async (id, fields) => {
      if (state.failUpdate) throw state.failUpdate;
      state.updates.push([id, fields]);
    }),
    delete: vi.fn(async (id) => { state.deletes.push(id); }),
  },
  CollectionMember: { filter: vi.fn(async () => state.memberships) },
}));

const { default: GeckoDetail } = await import('@/pages/GeckoDetail');
const { default: GeckoDetailModal } = await import('@/components/my-geckos/GeckoDetailModal');

const OWNER = { id: 'u1', email: 'keeper@example.com' };
const NIMBUS = { id: 'g1', name: 'Nimbus', created_by: 'keeper@example.com', collection_id: 'c1' };

async function mountPage() {
  let tree;
  await act(async () => { tree = create(<GeckoDetail />); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return tree;
}

beforeEach(() => {
  state.gecko = { ...NIMBUS };
  state.user = OWNER;
  state.memberships = [];
  state.navigations.length = 0;
  state.updates.length = 0;
  state.deletes.length = 0;
  state.invalidated.length = 0;
  state.toasts.length = 0;
  state.failUpdate = null;
  state.lastRecordProps = null;
  state.locationKey = 'abc';
  vi.stubGlobal('window', { dispatchEvent: (e) => state.events.push(e.type), scrollTo: () => {} });
});

describe('/GeckoDetail shows the one record as a page', () => {
  it('loads the gecko from the link and gives its owner the keeper record', async () => {
    const tree = await mountPage();
    expect(tree.root.findAll((n) => n.props?.['data-record'] === 'page')).toHaveLength(1);
    const props = state.lastRecordProps;
    expect(props.gecko.id).toBe('g1');
    expect(props.canEdit).toBe(true);
    expect(typeof props.onDelete).toBe('function');
  });

  it('gives a collection editor edit rights and a viewer only membership', async () => {
    state.user = { id: 'u2', email: 'editor@example.com' };
    state.memberships = [{ collection_id: 'c1', status: 'accepted', role: 'editor' }];
    await mountPage();
    expect(state.lastRecordProps).toMatchObject({ canEdit: true, isMember: true });

    state.memberships = [{ collection_id: 'c1', status: 'accepted', role: 'viewer' }];
    await mountPage();
    expect(state.lastRecordProps).toMatchObject({ canEdit: false, isMember: true });
  });

  it('gives a signed-out visitor the public record', async () => {
    state.user = null;
    state.gecko = { ...NIMBUS, created_by: undefined };
    await mountPage();
    expect(state.lastRecordProps).toMatchObject({ canEdit: false, isMember: false, currentUser: null });
  });

  it('sends Edit and Archive to My Geckos, where the form and the archive dialog live', async () => {
    await mountPage();
    await act(async () => { state.lastRecordProps.onEdit(state.gecko); });
    await act(async () => { state.lastRecordProps.onArchive('g1', true); });
    await act(async () => { state.lastRecordProps.onMarkSold('g1'); });
    expect(state.navigations.map(([to]) => to)).toEqual([
      '/MyGeckos?gecko=g1&open=edit',
      '/MyGeckos?gecko=g1&open=archive',
      '/MyGeckos?gecko=g1&open=sold',
    ]);
    expect(state.updates).toHaveLength(0);
  });

  it('unarchives in place, clearing the sale, and marks My Geckos stale', async () => {
    await mountPage();
    await act(async () => { await state.lastRecordProps.onArchive('g1', false); });
    expect(state.updates).toEqual([['g1', { archived: false, archived_date: null, archive_reason: null, sold_price: null, sale_category: null }]]);
    expect(state.invalidated).toContainEqual(['my-geckos']);
    expect(state.events).toContain('geckos_changed');
  });

  it('says so when the plan is full instead of failing silently', async () => {
    state.failUpdate = Object.assign(new Error('gecko_limit_reached'), { hint: 'gecko_limit_reached' });
    await mountPage();
    await act(async () => { await state.lastRecordProps.onArchive('g1', false); });
    expect(state.toasts.at(-1).title).toBe('Your plan is full');
  });

  it('deletes, then goes back to My Geckos with the list marked stale', async () => {
    await mountPage();
    await act(async () => { await state.lastRecordProps.onDelete('g1'); });
    expect(state.deletes).toEqual(['g1']);
    expect(state.invalidated).toContainEqual(['my-geckos']);
    expect(state.navigations.at(-1)).toEqual(['/MyGeckos', { replace: true }]);
  });

  it('Back from an emailed link goes to My Geckos instead of leaving the site', async () => {
    state.locationKey = 'default';
    await mountPage();
    const back = state.lastRecordProps.leading;
    await act(async () => { back.props.onClick(); });
    expect(state.navigations.at(-1)).toEqual(['/MyGeckos', undefined]);
  });

  it('says when a gecko cannot be found', async () => {
    state.gecko = null;
    const tree = await mountPage();
    expect(JSON.stringify(tree.toJSON())).toContain('Gecko not found');
  });
});

describe('the My Geckos window hosts the same record', () => {
  it('is a dialog over the list, with a close button and the member-level record', async () => {
    const onClose = vi.fn();
    let tree;
    await act(async () => {
      tree = create(<GeckoDetailModal gecko={NIMBUS} currentUser={OWNER} canEdit onClose={onClose} onDelete={vi.fn()} />);
    });
    const dialog = tree.root.find((n) => n.props?.role === 'dialog');
    expect(dialog.props['aria-modal']).toBe('true');
    expect(state.lastRecordProps).toMatchObject({ variant: 'modal', isMember: true, canEdit: true });
    await act(async () => { state.lastRecordProps.leading.props.onClick(); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('never assumes edit rights the host did not give', async () => {
    await act(async () => { create(<GeckoDetailModal gecko={NIMBUS} currentUser={OWNER} onClose={vi.fn()} />); });
    expect(state.lastRecordProps.canEdit).toBe(false);
  });
});

describe('one record, not two', () => {
  const root = path.resolve(__dirname, '../../../..');
  const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

  it('both entry points render GeckoRecord and draw no history of their own', () => {
    for (const file of ['pages/GeckoDetail.jsx', 'components/my-geckos/GeckoDetailModal.jsx']) {
      const text = read(file);
      expect(text, file).toMatch(/import GeckoRecord from '@\/components\/gecko\/record\/GeckoRecord'/);
      for (const section of ['WeightChart', 'VetRecordsSection', 'HusbandryHistory', 'MarketValueCard', 'TransferDialog', 'certificateUtils', 'buyerPacket']) {
        expect(text, `${file} imports ${section}`).not.toContain(section);
      }
    }
  });

  it('nothing loads the PDF builders up front', () => {
    const files = fs.readdirSync(path.join(root, 'components/gecko/record')).filter((f) => /\.jsx?$/.test(f));
    for (const file of files) {
      const text = read(`components/gecko/record/${file}`);
      expect(text, file).not.toMatch(/^import .*(certificateUtils|buyerPacket)/m);
    }
  });
});
