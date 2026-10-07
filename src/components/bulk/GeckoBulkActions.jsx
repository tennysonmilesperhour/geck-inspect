import BulkActions from './BulkActions';
import { Gecko } from '@/entities/all';

export default function GeckoBulkActions({ records, onComplete, extraActions = [] }) {
    const update = key => (record, value) => Gecko.update(record.id, { [key]: value });
    return <BulkActions records={records} noun="geckos" getLabel={g => g.name || g.gecko_id_code || g.id}
        categories={[{ key: 'sex', label: 'Sex' }, { key: 'status', label: 'Status' }, { key: 'species', label: 'Species' }, { key: 'morph_tags', label: 'Morph' }]}
        actions={[
            { id: 'status', label: 'Change status', options: ['Pet', 'Future Breeder', 'Holdback', 'Ready to Breed', 'Proven', 'For Sale', 'Sold'], run: update('status') },
            { id: 'sex', label: 'Change sex', options: ['Unsexed', 'Male', 'Female'], run: update('sex') },
            { id: 'price', label: 'Set asking price', input: 'number', min: 0, step: '0.01', validate: v => !Number.isFinite(Number(v)) || Number(v) < 0 ? 'Enter a valid price of zero or more.' : null, run: (r, v) => Gecko.update(r.id, { asking_price: Number(v) }) },
            { id: 'public', label: 'Make public', description: 'These geckos can appear in your public store and gallery.', run: r => Gecko.update(r.id, { is_public: true }) },
            { id: 'private', label: 'Make private', run: r => Gecko.update(r.id, { is_public: false }) },
            ...extraActions,
            { id: 'delete', label: 'Delete geckos', destructive: true, description: 'Deleting sold geckos also removes their sale amounts from revenue reports. Archive them to keep that history.', run: r => Gecko.delete(r.id) },
        ]} onComplete={onComplete} />;
}
