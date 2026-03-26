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

        const { morphs } = await req.json();
        const priceCache = await base44.entities.MorphPriceCache.list();
        
        const priceRanges = {};
        for (const morph of morphs) {
            const cachedPrice = priceCache.find(p => p.morph_name.toLowerCase() === morph.toLowerCase());
            if (cachedPrice) {
                priceRanges[morph] = {
                    low: cachedPrice.low_price,
                    high: cachedPrice.high_price,
                    average: cachedPrice.average_price,
                    currency: cachedPrice.currency,
                    lastUpdated: cachedPrice.updated_date 
                };
            }
        }

        return new Response(JSON.stringify({ priceRanges }), {
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