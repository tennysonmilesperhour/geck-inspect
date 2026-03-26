import { createClient } from 'npm:@base44/sdk@0.1.0';

const base44 = createClient({
    appId: Deno.env.get('BASE44_APP_ID'),
});

Deno.serve(async (req) => {
    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response('Unauthorized', { status: 401 });
        }
        const token = authHeader.split(' ')[1];
        base44.auth.setToken(token);
        
        const user = await base44.auth.me();
        if (!user) {
            return new Response('Unauthorized', { status: 401 });
        }

        const { includeExisting = false } = await req.json();

        // CSV Headers
        const headers = [
            'name',
            'gecko_id_code',
            'sex',
            'hatch_date',
            'status',
            'morphs_traits',
            'notes',
            'custom_category',
            'asking_price',
            'sire_id_code',
            'dam_id_code',
            'current_weight_grams',
            'weight_date',
            'last_shed_date',
            'breeding_notes',
            'health_notes',
            'acquisition_date',
            'acquisition_source'
        ];

        let csvContent = headers.join(',') + '\n';

        // Add example row with instructions
        const exampleRow = [
            'Example Gecko',
            'EXM-001',
            'Female',
            '2023-06-15',
            'Ready to Breed',
            'Flame Dalmatian Red Base',
            'Very docile temperament',
            'Breeders',
            '250.00',
            'SIRE-001',
            'DAM-001',
            '52.3',
            '2024-01-15',
            '2024-01-10',
            'First breeding season',
            'Healthy, no issues',
            '2023-07-01',
            'Local breeder'
        ];
        csvContent += exampleRow.join(',') + '\n';

        // Add instructions row
        const instructionsRow = [
            'INSTRUCTIONS: Delete this row before importing',
            'Unique ID for each gecko',
            'Male/Female/Unsexed',
            'YYYY-MM-DD format',
            'Pet/Future Breeder/Holdback/Ready to Breed/Proven/For Sale/Sold',
            'Describe morphs and traits',
            'General notes',
            'Category name',
            'Price if for sale',
            'ID of father gecko',
            'ID of mother gecko',
            'Current weight in grams',
            'Date weight was recorded',
            'Date of last shed',
            'Breeding related notes',
            'Health related notes',
            'Date acquired',
            'Where acquired from'
        ];
        csvContent += '"' + instructionsRow.join('","') + '"\n';

        // Optionally include existing geckos for updating
        if (includeExisting) {
            const existingGeckos = await base44.entities.Gecko.filter({ created_by: user.email });
            
            for (const gecko of existingGeckos) {
                const row = [
                    gecko.name || '',
                    gecko.gecko_id_code || '',
                    gecko.sex || '',
                    gecko.hatch_date || '',
                    gecko.status || '',
                    gecko.morphs_traits || '',
                    gecko.notes || '',
                    gecko.custom_category || '',
                    gecko.asking_price || '',
                    '', // sire_id_code - would need lookup
                    '', // dam_id_code - would need lookup
                    '', // current_weight_grams - would need latest weight
                    '', // weight_date
                    '', // last_shed_date
                    '', // breeding_notes
                    '', // health_notes
                    '', // acquisition_date
                    ''  // acquisition_source
                ];
                csvContent += '"' + row.join('","') + '"\n';
            }
        }

        return new Response(csvContent, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': 'attachment; filename="gecko_import_template.csv"'
            }
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
});