import { createClientFromRequest } from 'npm:@base44/sdk@0.5.0';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.role !== 'admin') {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
                status: 403,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const { timeframe = '30' } = await req.json();
        
        // Calculate date range
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(timeframe));

        // Fetch recent activity data
        const [recentUsers, recentGeckos, recentImages, recentPosts] = await Promise.all([
            base44.asServiceRole.entities.User.filter({
                created_date: { $gte: startDate.toISOString() }
            }),
            base44.asServiceRole.entities.Gecko.filter({
                created_date: { $gte: startDate.toISOString() }
            }),
            base44.asServiceRole.entities.GeckoImage.filter({
                created_date: { $gte: startDate.toISOString() }
            }),
            base44.asServiceRole.entities.ForumPost.filter({
                created_date: { $gte: startDate.toISOString() }
            })
        ]);

        // Generate comprehensive update using direct LLM call
        const prompt = `Create a comprehensive platform update announcement for "Geck Inspect", a crested gecko breeding and identification platform.

        Based on the following activity data from the last ${timeframe} days:
        - ${recentUsers.length} new users joined the community
        - ${recentGeckos.length} new geckos were added to collections
        - ${recentImages.length} new images were uploaded for AI training
        - ${recentPosts.length} new forum posts were created

        Create an engaging announcement that:
        1. Thanks the community for their engagement
        2. Highlights community growth and activity
        3. Mentions platform improvements and new features (you can mention things like enhanced AI accuracy, improved breeding tools, marketplace updates, mobile optimization, etc.)
        4. Encourages continued participation
        5. Has a professional but friendly tone
        6. Is around 300-500 words
        7. Includes specific numbers from the activity data
        8. Ends with a call to action

        Please provide both a compelling subject line and the full announcement content.`;

        const response = await base44.asServiceRole.integrations.invoke('Core', 'InvokeLLM', {
            prompt,
            response_json_schema: {
                type: "object",
                properties: {
                    subject: { type: "string" },
                    content: { type: "string" },
                    highlights: {
                        type: "array",
                        items: { type: "string" }
                    }
                }
            }
        });

        return new Response(JSON.stringify({
            success: true,
            update: response,
            stats: {
                timeframe: `${timeframe} days`,
                newUsers: recentUsers.length,
                newGeckos: recentGeckos.length,
                newImages: recentImages.length,
                newPosts: recentPosts.length
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error generating update:', error);
        return new Response(JSON.stringify({ 
            success: false, 
            error: error.message 
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
});