import { createClient } from 'npm:@base44/sdk@0.1.0';

const base44 = createClient({
    appId: Deno.env.get('BASE44_APP_ID'),
});

Deno.serve(async (req) => {
    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        const token = authHeader.split(' ')[1];
        base44.auth.setToken(token);
        
        const user = await base44.auth.me();
        if (!user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const { imageUrl } = await req.json();

        if (!imageUrl) {
            return new Response(JSON.stringify({ error: 'Image URL is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const prompt = `Analyze this crested gecko image and classify its morph. Look for flame, harlequin, pinstripe, tiger, dalmatian, or patternless patterns. Also identify the base color and any secondary traits. Provide a confidence score from 1-100.`;

        const response = await base44.integrations.Core.InvokeLLM({
            prompt,
            file_urls: [imageUrl],
            response_json_schema: {
                type: "object",
                properties: {
                    primary_morph: { type: "string" },
                    secondary_traits: { type: "array", items: { type: "string" } },
                    base_color: { type: "string" },
                    pattern_intensity: { type: "string" },
                    confidence_score: { type: "number" },
                    explanation: { type: "string" }
                },
                required: ["primary_morph", "confidence_score", "explanation"]
            }
        });

        return new Response(JSON.stringify({
            success: true,
            analysis: response
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        return new Response(JSON.stringify({ 
            error: error.message,
            success: false 
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
});