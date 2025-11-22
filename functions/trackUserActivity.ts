import { createClientFromRequest } from 'npm:@base44/sdk@0.5.0';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        if (!(await base44.auth.isAuthenticated())) {
            return new Response('Unauthorized', { status: 401 });
        }

        const user = await base44.auth.me();
        const { activity_type, points = 1, related_entity_id = null } = await req.json();

        if (!activity_type) {
            return new Response(JSON.stringify({ error: 'Activity type is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Create activity record
        const activity = await base44.entities.UserActivity.create({
            user_email: user.email,
            activity_type,
            points,
            related_entity_id
        });

        // Check if this activity should trigger badges
        await checkForNewBadges(base44, user, activity_type);

        return new Response(JSON.stringify({ success: true, activity }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error tracking user activity:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
});

async function checkForNewBadges(base44, user, activityType) {
    try {
        const existingBadges = await base44.entities.UserBadge.filter({ user_email: user.email });
        const existingBadgeTypes = existingBadges.map(b => `${b.badge_type}_${b.badge_name}`);

        // Get current user stats
        const [geckos, images, posts] = await Promise.all([
            base44.entities.Gecko.filter({ created_by: user.email }),
            base44.entities.GeckoImage.filter({ created_by: user.email }),
            base44.entities.ForumPost.filter({ created_by: user.email })
        ]);

        const newBadges = [];

        // Collection milestone badges
        const collectionMilestones = [
            { count: 10, name: 'Gecko Collector', icon: '🦎', rarity: 'uncommon' },
            { count: 25, name: 'Serious Breeder', icon: '🏆', rarity: 'rare' },
            { count: 50, name: 'Master Keeper', icon: '👑', rarity: 'epic' },
            { count: 100, name: 'Gecko Royalty', icon: '🌟', rarity: 'legendary' }
        ];

        for (const milestone of collectionMilestones) {
            const badgeKey = `contributor_${milestone.name}`;
            if (geckos.length >= milestone.count && !existingBadgeTypes.includes(badgeKey)) {
                newBadges.push({
                    user_email: user.email,
                    badge_type: 'contributor',
                    badge_name: milestone.name,
                    badge_description: `Reached ${milestone.count} geckos in collection!`,
                    badge_icon: milestone.icon,
                    requirements_met: { gecko_count: geckos.length },
                    rarity: milestone.rarity
                });
            }
        }

        // AI Training milestone badges
        const trainingMilestones = [
            { count: 25, name: 'AI Contributor', icon: '🤖', rarity: 'uncommon' },
            { count: 100, name: 'Training Champion', icon: '🎯', rarity: 'rare' },
            { count: 500, name: 'Data Scientist', icon: '📊', rarity: 'epic' },
            { count: 1000, name: 'AI Pioneer', icon: '🚀', rarity: 'legendary' }
        ];

        for (const milestone of trainingMilestones) {
            const badgeKey = `trainer_${milestone.name}`;
            if (images.length >= milestone.count && !existingBadgeTypes.includes(badgeKey)) {
                newBadges.push({
                    user_email: user.email,
                    badge_type: 'trainer',
                    badge_name: milestone.name,
                    badge_description: `Contributed ${milestone.count}+ images for AI training!`,
                    badge_icon: milestone.icon,
                    requirements_met: { image_count: images.length },
                    rarity: milestone.rarity
                });
            }
        }

        // Community engagement badges
        const communityMilestones = [
            { count: 5, name: 'Active Member', icon: '💬', rarity: 'common' },
            { count: 20, name: 'Community Contributor', icon: '🌱', rarity: 'uncommon' },
            { count: 50, name: 'Forum Regular', icon: '⭐', rarity: 'rare' },
            { count: 100, name: 'Community Leader', icon: '👥', rarity: 'epic' }
        ];

        for (const milestone of communityMilestones) {
            const badgeKey = `community_helper_${milestone.name}`;
            if (posts.length >= milestone.count && !existingBadgeTypes.includes(badgeKey)) {
                newBadges.push({
                    user_email: user.email,
                    badge_type: 'community_helper',
                    badge_name: milestone.name,
                    badge_description: `Made ${milestone.count}+ forum contributions!`,
                    badge_icon: milestone.icon,
                    requirements_met: { post_count: posts.length },
                    rarity: milestone.rarity
                });
            }
        }

        // Create new badges and send notifications
        for (const badge of newBadges) {
            await base44.entities.UserBadge.create(badge);
            
            // Send notification about new badge
            await base44.entities.Notification.create({
                user_email: user.email,
                type: 'level_up',
                content: `🎉 Achievement Unlocked: ${badge.badge_name}! ${badge.badge_description}`,
                link: '/MyProfile?tab=overview'
            });
        }

    } catch (error) {
        console.error('Error checking for new badges:', error);
    }
}