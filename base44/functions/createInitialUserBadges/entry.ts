import { createClientFromRequest } from 'npm:@base44/sdk@0.5.0';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        if (!(await base44.auth.isAuthenticated())) {
            return new Response('Unauthorized', { status: 401 });
        }

        const user = await base44.auth.me();
        
        // Check if user already has badges to avoid duplicates
        const existingBadges = await base44.entities.UserBadge.filter({ user_email: user.email });
        
        if (existingBadges.length > 0) {
            return new Response(JSON.stringify({ 
                success: true, 
                message: 'User already has badges',
                badges: existingBadges 
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Get user's activity data to determine appropriate badges
        const [geckos, images, posts, morphSubmissions] = await Promise.all([
            base44.entities.Gecko.filter({ created_by: user.email }),
            base44.entities.GeckoImage.filter({ created_by: user.email }),
            base44.entities.ForumPost.filter({ created_by: user.email }),
            base44.entities.MorphReferenceImage.filter({ submitted_by_email: user.email })
        ]);

        const badges = [];

        // Welcome badge for all users
        badges.push({
            user_email: user.email,
            badge_type: 'contributor',
            badge_name: 'Welcome to Geck Inspect!',
            badge_description: 'Welcome to the community! Start your gecko journey here.',
            badge_icon: '👋',
            requirements_met: { joined_date: new Date().toISOString() },
            rarity: 'common'
        });

        // Collection badges based on gecko count
        if (geckos.length >= 1) {
            badges.push({
                user_email: user.email,
                badge_type: 'contributor',
                badge_name: 'First Gecko',
                badge_description: 'Added your first gecko to your collection.',
                badge_icon: '🦎',
                requirements_met: { gecko_count: geckos.length },
                rarity: 'common'
            });
        }

        if (geckos.length >= 5) {
            badges.push({
                user_email: user.email,
                badge_type: 'contributor',
                badge_name: 'Gecko Enthusiast',
                badge_description: 'Growing collection with 5+ geckos.',
                badge_icon: '🌿',
                requirements_met: { gecko_count: geckos.length },
                rarity: 'uncommon'
            });
        }

        // AI Training badges based on image count
        if (images.length >= 1) {
            badges.push({
                user_email: user.email,
                badge_type: 'trainer',
                badge_name: 'AI Trainer',
                badge_description: 'Contributed your first image to AI training.',
                badge_icon: '🤖',
                requirements_met: { image_count: images.length },
                rarity: 'common'
            });
        }

        if (images.length >= 10) {
            badges.push({
                user_email: user.email,
                badge_type: 'trainer',
                badge_name: 'Pattern Recognition Pro',
                badge_description: 'Contributed 10+ images for AI training.',
                badge_icon: '🎯',
                requirements_met: { image_count: images.length },
                rarity: 'uncommon'
            });
        }

        // Community badges based on forum activity
        if (posts.length >= 1) {
            badges.push({
                user_email: user.email,
                badge_type: 'community_helper',
                badge_name: 'Community Voice',
                badge_description: 'Made your first contribution to the forum.',
                badge_icon: '💬',
                requirements_met: { post_count: posts.length },
                rarity: 'common'
            });
        }

        // Expert badges
        if (user.is_expert) {
            badges.push({
                user_email: user.email,
                badge_type: 'expert_verifier',
                badge_name: 'Expert Verifier',
                badge_description: 'Trusted expert who can verify classifications.',
                badge_icon: '🛡️',
                requirements_met: { expert_status: true },
                rarity: 'rare'
            });
        }

        // Admin badges
        if (user.role === 'admin') {
            badges.push({
                user_email: user.email,
                badge_type: 'expert_verifier',
                badge_name: 'Platform Administrator',
                badge_description: 'Helps maintain and improve the platform.',
                badge_icon: '⚡',
                requirements_met: { admin_status: true },
                rarity: 'legendary'
            });
        }

        // Create all badges
        const createdBadges = await Promise.all(
            badges.map(badge => base44.entities.UserBadge.create(badge))
        );

        return new Response(JSON.stringify({
            success: true,
            message: `Created ${createdBadges.length} badges for user`,
            badges: createdBadges
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error creating user badges:', error);
        return new Response(JSON.stringify({ 
            success: false, 
            error: error.message 
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
});