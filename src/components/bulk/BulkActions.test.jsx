import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import BulkActions from './BulkActions';

vi.mock('@/components/ui/button', () => ({ Button: props => <button {...props} /> }));
vi.mock('@/components/ui/input', () => ({ Input: props => <input {...props} /> }));
vi.mock('@/components/ui/dialog', () => ({
    Dialog: ({ open, children }) => open ? <div>{children}</div> : null,
    DialogContent: ({ children }) => <div>{children}</div>,
    DialogHeader: ({ children }) => <div>{children}</div>,
    DialogTitle: ({ children }) => <h2>{children}</h2>,
    DialogDescription: ({ children }) => <p>{children}</p>,
}));

const textOf = node => node.children.map(x => typeof x === 'string' ? x : textOf(x)).join('');
const button = (view, text) => view.root.findAllByType('button').find(b => textOf(b) === text);

describe('bulk action dialog', () => {
    it('selects only category matches, confirms before writing, and retries only failures', async () => {
        const records = [{ id: 'a', name: 'A', sex: 'Female' }, { id: 'b', name: 'B', sex: 'Male' }, { id: 'c', name: 'C', sex: 'Female' }];
        const run = vi.fn(async r => { if (r.id === 'c') throw new Error('Denied'); });
        let view;
        await act(async () => { view = create(<BulkActions records={records} noun="geckos" categories={[{ key: 'sex', label: 'Sex' }]} actions={[{ id: 'delete', label: 'Delete', destructive: true, run }]} getLabel={r => r.name} />); });
        await act(async () => button(view, 'Bulk actions: geckos').props.onClick());
        await act(async () => view.root.findAllByType('select')[0].props.onChange({ target: { value: 'Female' } }));
        await act(async () => button(view, 'Select all matching (2)').props.onClick());
        expect(view.root.findAllByType('input').map(i => i.props.checked)).toEqual([true, true]);
        await act(async () => view.root.findAllByType('select')[1].props.onChange({ target: { value: 'delete' } }));
        await act(async () => button(view, 'Review changes').props.onClick());
        expect(run).not.toHaveBeenCalled();
        await act(async () => button(view, 'Confirm').props.onClick());
        expect(run.mock.calls.map(([r]) => r.id)).toEqual(['a', 'c']);
        expect(view.root.findAllByType('input').map(i => i.props.checked)).toEqual([false, true]);
        run.mockResolvedValue(undefined);
        await act(async () => button(view, 'Review changes').props.onClick());
        await act(async () => button(view, 'Confirm').props.onClick());
        expect(run.mock.calls.map(([r]) => r.id)).toEqual(['a', 'c', 'c']);
        await act(async () => view.unmount());
    });
    it('drops selection when category changes', async () => {
        let view;
        await act(async () => { view = create(<BulkActions records={[{ id: 'a', sex: 'Female' }]} noun="eggs" categories={[{ key: 'sex', label: 'Sex' }]} actions={[]} getLabel={r => r.id} />); });
        await act(async () => button(view, 'Bulk actions: eggs').props.onClick());
        await act(async () => button(view, 'Select all matching (1)').props.onClick());
        await act(async () => view.root.findAllByType('select')[0].props.onChange({ target: { value: 'Female' } }));
        expect(view.root.findByType('input').props.checked).toBe(false);
        await act(async () => view.unmount());
    });
});
