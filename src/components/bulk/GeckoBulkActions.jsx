import BulkActions from './BulkActions';
import { Gecko } from '@/entities/all';
import { canDeleteGecko } from '@/lib/geckoAccess';

// `user`, when given, limits Delete to the geckos the user owns: a
// collection editor can edit a shared gecko but not delete it (the
// database refuses it too). A gecko that cannot be deleted is reported
// as failed with the reason instead of silently staying.
export default function GeckoBulkActions({ records, onComplete, extraActions = [], user = null }) {
    const update = key => (record, value) => Gecko.update(record.id, { [key]: value });
    const remove = async (record) => {
        if (user && !canDeleteGecko(record, user)) {
            throw new Error("Only the gecko's owner can delete it.");
        }
        return Gecko.delete(record.id);
    };
    return <BulkActions records={records} noun="geckos" getLabel={g => g.name || g.gecko_id_code || g.id}
        categories={[{ key: 'sex', label: 'Sex' }, { key: 'status', label: 'Status' }, { key: 'species', label: 'Species' }, { key: 'morph_tags', label: 'Morph' }]}
        actions={[
            { id: 'status', label: 'Change status', options: ['Pet', 'Future Breeder', 'Holdback', 'Ready to Breed', 'Proven', 'For Sale', 'Sold'], run: update('status') },
            { id: 'sex', label: 'Change sex', options: ['Unsexed', 'Male', 'Female'], run: update('sex') },
            { id: 'price', label: 'Set asking price', input: 'number', min: 0, step: '0.01', validate: v => !Number.isFinite(Number(v)) || Number(v) < 0 ? 'Enter a valid price of zero or more.' : null, run: (r, v) => Gecko.update(r.id, { asking_price: Number(v) }) },
            { id: 'public', label: 'Make public', description: 'These geckos can appear in your public store and gallery.', run: r => Gecko.update(r.id, { is_public: true }) },
            { id: 'private', label: 'Make private', run: r => Gecko.update(r.id, { is_public: false }) },
            ...extraActions,
            { id: 'delete', label: 'Delete geckos', destructive: true, description: 'Deleting sold geckos also removes their sale amounts from revenue reports. Archive them to keep that history.', run: remove },
        ]} onComplete={onComplete} />;
}
