import BulkActions from './BulkActions';
import { Egg } from '@/entities/all';
import { eggStatusFields, hatchDateProblem, hatchEgg } from '@/lib/hatchEgg';
import { todayLocalISO } from '@/lib/dateUtils';
import { eggSeasonYear } from '@/lib/seasons';

export default function EggBulkActions({ records, allEggs, plans, geckos, onComplete }) {
    // Each successful hatch feeds the next one so sibling names and IDs advance.
    let batchEggs = [...allEggs];
    const planFor = egg => plans.find(p => p.id === egg.breeding_plan_id);
    const label = egg => {
        const plan = planFor(egg);
        const sire = geckos.find(g => g.id === plan?.sire_id);
        const dam = geckos.find(g => g.id === plan?.dam_id);
        return `${sire?.name || 'Unknown'} × ${dam?.name || 'Unknown'} · ${egg.lay_date || ''} · Egg ${String(egg.id).slice(-6)}`;
    };
    return <BulkActions records={records.map(e => ({ ...e, season: String(eggSeasonYear(e) || ''), pair: planFor(e)?.breeding_id || e.breeding_plan_id }))}
        noun="eggs" getLabel={label}
        categories={[{ key: 'status', label: 'Status' }, { key: 'grade', label: 'Grade' }, { key: 'season', label: 'Season' }, { key: 'pair', label: 'Breeding pair' }, { key: 'lay_date', label: 'Lay date / clutch' }]}
        actions={[
            { id: 'status', label: 'Change status', options: ['Incubating', 'Infertile', 'Slug', 'Stillbirth'], description: 'Failed eggs move to the archive. Incubating eggs return to the active hatchery.', run: (egg, status) => Egg.update(egg.id, eggStatusFields(status)) },
            { id: 'hatch', label: 'Record hatches', input: 'date', inputLabel: 'Hatch date for selected eggs', max: todayLocalISO(), description: 'Creates and links a hatchling for each egg, then archives the eggs. You can record individual morph outcomes from each pairing.', validate: (date, eggs) => eggs.map(e => hatchDateProblem(date, e)).find(Boolean), run: async (egg, date) => {
                if (egg.status === 'Hatched') throw new Error('This egg is already hatched. Use its detail screen to correct its hatch date.');
                const plan = planFor(egg);
                const result = await hatchEgg({ egg, plan, sire: geckos.find(g => g.id === plan?.sire_id), dam: geckos.find(g => g.id === plan?.dam_id), pairEggs: batchEggs.filter(e => e.breeding_plan_id === egg.breeding_plan_id), hatchDate: date });
                batchEggs = batchEggs.map(e => e.id === egg.id ? { ...e, ...result.egg, status: 'Hatched', gecko_id: result.gecko.id } : e);
            } },
            { id: 'grade', label: 'Set grade', options: ['A+', 'A', 'B', 'C', 'D'], run: (egg, grade) => Egg.update(egg.id, { grade }) },
            { id: 'archive', label: 'Archive eggs', run: egg => Egg.update(egg.id, { archived: true, archived_date: todayLocalISO() }) },
            { id: 'delete', label: 'Delete eggs', destructive: true, description: 'Linked hatchlings stay in your collection.', run: egg => Egg.delete(egg.id) },
        ]} onComplete={onComplete} />;
}
