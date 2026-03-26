Deno.serve(async (req) => {
    try {
        const { url, size = 200 } = await req.json();
        
        // Generate QR code using QR Server API (free service)
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}`;
        
        const response = await fetch(qrUrl);
        const imageData = await response.arrayBuffer();
        
        return new Response(imageData, {
            status: 200,
            headers: {
                'Content-Type': 'image/png'
            }
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
});