import { createClient } from 'npm:@base44/sdk@0.1.0';
import { ExtractDataFromUploadedFile } from '@/integrations/Core';

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

        const body = await req.json();
        const { fileUrl, importMode = 'create_and_update' } = body;

        if (!fileUrl) {
            return new Response(JSON.stringify({ error: 'File URL is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Define the expected CSV schema
        const csvSchema = {
            type: "array",
            items: {
                type: "object",
                properties: {
                    name: { type: "string" },
                    gecko_id_code: { type: "string" },
                    sex: { type: "string" },
                    hatch_date: { type: "string" },
                    status: { type: "string" },
                    morphs_traits: { type: "string" },
                    notes: { type: "string" },
                    custom_category: { type: "string" },
                    asking_price: { type: "string" },
                    sire_id_code: { type: "string" },
                    dam_id_code: { type: "string" },
                    current_weight_grams: { type: "string" },
                    weight_date: { type: "string" },
                    last_shed_date: { type: "string" },
                    breeding_notes: { type: "string" },
                    health_notes: { type: "string" },
                    acquisition_date: { type: "string" },
                    acquisition_source: { type: "string" }
                }
            }
        };

        // Extract data from uploaded CSV
        const extractResult = await ExtractDataFromUploadedFile({
            file_url: fileUrl,
            json_schema: csvSchema
        });

        if (extractResult.status !== 'success') {
            return new Response(JSON.stringify({ 
                error: 'Failed to parse CSV file',
                details: extractResult.details 
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const csvData = extractResult.output;
        const results = {
            processed: 0,
            created: 0,
            updated: 0,
            errors: [],
            warnings: []
        };

        // Get existing geckos for the user
        const existingGeckos = await base44.entities.Gecko.filter({ created_by: user.email });
        const geckoLookup = {};
        existingGeckos.forEach(gecko => {
            if (gecko.gecko_id_code) {
                geckoLookup[gecko.gecko_id_code] = gecko;
            }
        });

        // Process each row
        for (let i = 0; i < csvData.length; i++) {
            const row = csvData[i];
            results.processed++;

            try {
                // Skip instruction rows
                if (row.name && (row.name.toLowerCase().includes('instruction') || row.name.toLowerCase().includes('example'))) {
                    results.processed--;
                    continue;
                }

                // Validate required fields
                if (!row.name || !row.sex) {
                    results.errors.push(`Row ${i + 1}: Name and sex are required`);
                    continue;
                }

                // Prepare gecko data
                const geckoData = {
                    name: row.name,
                    gecko_id_code: row.gecko_id_code || '',
                    sex: row.sex,
                    hatch_date: row.hatch_date || null,
                    status: row.status || 'Pet',
                    morphs_traits: row.morphs_traits || '',
                    notes: row.notes || '',
                    custom_category: row.custom_category || '',
                    asking_price: row.asking_price ? parseFloat(row.asking_price) : null
                };

                // Handle lineage relationships using ID codes
                if (row.sire_id_code && geckoLookup[row.sire_id_code]) {
                    geckoData.sire_id = geckoLookup[row.sire_id_code].id;
                } else if (row.sire_id_code) {
                    results.warnings.push(`Row ${i + 1}: Sire with ID '${row.sire_id_code}' not found`);
                }

                if (row.dam_id_code && geckoLookup[row.dam_id_code]) {
                    geckoData.dam_id = geckoLookup[row.dam_id_code].id;
                } else if (row.dam_id_code) {
                    results.warnings.push(`Row ${i + 1}: Dam with ID '${row.dam_id_code}' not found`);
                }

                // Check if gecko exists
                let existingGecko = null;
                if (row.gecko_id_code && geckoLookup[row.gecko_id_code]) {
                    existingGecko = geckoLookup[row.gecko_id_code];
                } else {
                    existingGecko = existingGeckos.find(g => g.name === row.name);
                }

                let savedGecko;
                if (existingGecko && importMode === 'create_and_update') {
                    savedGecko = await base44.entities.Gecko.update(existingGecko.id, geckoData);
                    results.updated++;
                } else if (!existingGecko) {
                    savedGecko = await base44.entities.Gecko.create(geckoData);
                    results.created++;
                    geckoLookup[savedGecko.gecko_id_code] = savedGecko;
                } else {
                    results.warnings.push(`Row ${i + 1}: Gecko '${row.name}' already exists, skipping`);
                    continue;
                }

                // Handle weight record if provided
                if (row.current_weight_grams && parseFloat(row.current_weight_grams) > 0) {
                    try {
                        await base44.entities.WeightRecord.create({
                            gecko_id: savedGecko.id,
                            weight_grams: parseFloat(row.current_weight_grams),
                            record_date: row.weight_date || new Date().toISOString().split('T')[0]
                        });
                    } catch (weightError) {
                        results.warnings.push(`Row ${i + 1}: Could not create weight record`);
                    }
                }

                // Handle additional tracking data in notes
                if (row.last_shed_date || row.breeding_notes || row.health_notes || row.acquisition_date || row.acquisition_source) {
                    const additionalNotes = [
                        row.last_shed_date ? `Last shed: ${row.last_shed_date}` : '',
                        row.breeding_notes ? `Breeding: ${row.breeding_notes}` : '',
                        row.health_notes ? `Health: ${row.health_notes}` : '',
                        row.acquisition_date ? `Acquired: ${row.acquisition_date}` : '',
                        row.acquisition_source ? `Source: ${row.acquisition_source}` : ''
                    ].filter(Boolean).join(' | ');

                    if (additionalNotes) {
                        const currentNotes = savedGecko.notes || '';
                        const updatedNotes = currentNotes ? `${currentNotes}\n\n[Import Data] ${additionalNotes}` : `[Import Data] ${additionalNotes}`;
                        
                        await base44.entities.Gecko.update(savedGecko.id, { 
                            notes: updatedNotes 
                        });
                    }
                }

            } catch (error) {
                results.errors.push(`Row ${i + 1}: ${error.message}`);
            }
        }

        return new Response(JSON.stringify({
            success: true,
            results: results,
            message: `Import completed: ${results.created} created, ${results.updated} updated, ${results.errors.length} errors`
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
});