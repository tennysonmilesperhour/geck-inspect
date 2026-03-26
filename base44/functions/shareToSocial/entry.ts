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

        const { platform, geckoId, message } = await req.json();
        
        const gecko = await base44.entities.Gecko.filter({ id: geckoId, created_by: user.email });
        if (!gecko || gecko.length === 0) {
            return new Response('Gecko not found', { status: 404 });
        }

        const geckoData = gecko[0];
        const profileUrl = `${req.headers.get('origin')}/PublicProfile?user=${user.email}`;
        
        // Generate share URLs for different platforms
        const shareUrls = {
            facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(profileUrl)}&quote=${encodeURIComponent(message)}`,
            twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(profileUrl)}`,
            instagram: `https://www.instagram.com/`, // Instagram doesn't support direct URL sharing
            reddit: `https://reddit.com/submit?url=${encodeURIComponent(profileUrl)}&title=${encodeURIComponent(message)}`,
            linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(profileUrl)}`
        };

        return new Response(JSON.stringify({ 
            shareUrl: shareUrls[platform] || shareUrls.facebook,
            message: 'Share URL generated successfully'
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