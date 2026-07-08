import { createClientFromRequest } from 'npm:@base44/sdk@0.7.0';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { eggId } = await req.json();

        if (!eggId) {
            return Response.json({ error: 'Egg ID is required' }, { status: 400 });
        }

        // Get the egg and its breeding plan
        const egg = await base44.entities.Egg.get(eggId);
        if (!egg) {
            return Response.json({ error: 'Egg not found' }, { status: 404 });
        }

        const breedingPlan = await base44.entities.BreedingPlan.get(egg.breeding_plan_id);
        if (!breedingPlan) {
            return Response.json({ error: 'Breeding plan not found' }, { status: 404 });
        }

        // Get sire and dam
        const [sire, dam] = await Promise.all([
            base44.entities.Gecko.get(breedingPlan.sire_id),
            base44.entities.Gecko.get(breedingPlan.dam_id)
        ]);

        if (!sire || !dam) {
            return Response.json({ error: 'Parent geckos not found' }, { status: 404 });
        }

        // Generate gecko ID based on parents
        const sireCode = (sire.gecko_id_code || sire.name.substring(0, 3)).toUpperCase().replace(/[^A-Z0-9]/g, '');
        const damCode = (dam.gecko_id_code || dam.name.substring(0, 3)).toUpperCase().replace(/[^A-Z0-9]/g, '');
        
        // Find existing siblings to get the next number
        const siblings = await base44.entities.Gecko.filter({ 
            sire_id: breedingPlan.sire_id, 
            dam_id: breedingPlan.dam_id 
        });
        
        const nextId = siblings.length + 1;
        const geckoIdCode = `${sireCode}x${damCode}-${String(nextId).padStart(2, '0')}`;

        // Generate name based on parents and sibling count
        const geckoName = `${sire.name} x ${dam.name} #${nextId}`;

        // Create new gecko
        const newGecko = await base44.entities.Gecko.create({
            name: geckoName,
            gecko_id_code: geckoIdCode,
            hatch_date: egg.hatch_date_actual || new Date().toISOString().split('T')[0],
            sex: 'Unsexed',
            sire_id: breedingPlan.sire_id,
            dam_id: breedingPlan.dam_id,
            status: 'Future Breeder',
            morphs_traits: '',
            notes: `Hatched from egg laid on ${egg.lay_date}`,
            image_urls: [],
            custom_category: '',
            weight_grams: null,
            asking_price: null,
            image_crop_data: {}
        });

        // Update the egg to link to the new gecko
        await base44.entities.Egg.update(eggId, {
            gecko_id: newGecko.id,
            status: 'Hatched'
        });

        return Response.json({ 
            success: true, 
            gecko: newGecko,
            message: `Successfully created ${geckoName} from hatched egg`
        });

    } catch (error) {
        console.error('Error creating gecko from egg:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});