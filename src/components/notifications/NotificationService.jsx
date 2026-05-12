import { Notification, UserFollow, Gecko } from '@/entities/all';

// Email + push fanout happens inside Postgres: a trigger on the
// `notifications` table calls the send-push and send-email edge
// functions on every insert (see
// supabase/migrations/20260422203000_notifications_send_push_trigger.sql
// and 20260422210000_notifications_send_email_trigger.sql). The client
// only needs to insert the row ,  no client-side SendEmail or per-user
// preference lookup. The trigger reads the recipient's preferences and
// skips channels the user has disabled.

const LEVEL_THRESHOLDS = [1, 2, 5, 10, 15, 20, 30, 40, 50, 75, 100, 150, 200, 300, 500];
const LEVEL_TITLES = {
  1: 'New Collector', 2: 'Gecko Keeper', 5: 'Hobbyist', 10: 'Enthusiast',
  15: 'Dedicated Keeper', 20: 'Breeder', 30: 'Pro Breeder', 40: 'Expert Breeder',
  50: 'Master Breeder', 75: 'Grandmaster', 100: 'Living Legend', 150: 'Gecko Tycoon',
  200: 'Scale Sovereign', 300: 'Reptile Royalty', 500: 'Crested King',
};

// Check if a user just crossed a gecko count milestone and notify them
export async function checkAndNotifyLevelUp(userEmail) {
    try {
        const geckos = await Gecko.filter({ created_by: userEmail });
        const count = geckos.filter(g => !g.archived).length;
        const matchedThreshold = LEVEL_THRESHOLDS.find(t => t === count);
        if (matchedThreshold && LEVEL_TITLES[matchedThreshold]) {
            await Notification.create({
                user_email: userEmail,
                type: 'level_up',
                content: `You've reached ${LEVEL_TITLES[matchedThreshold]} status with ${count} geckos in your collection!`,
                link: '/MyGeckos',
                metadata: { level: LEVEL_TITLES[matchedThreshold], gecko_count: count }
            });
        }
    } catch (error) {
        console.error('Failed to check level up:', error);
    }
}

// Notify all followers when a user lists a new public gecko
export async function notifyFollowersNewGecko(gecko, ownerEmail, ownerName) {
    if (!gecko.is_public) return;
    try {
        const followers = await UserFollow.filter({ following_email: ownerEmail });
        await Promise.all(followers.map(follow =>
            Notification.create({
                user_email: follow.follower_email,
                type: 'new_gecko_listing',
                content: `${ownerName || ownerEmail} listed a new gecko: ${gecko.name}`,
                link: `/PublicProfile?email=${encodeURIComponent(ownerEmail)}`,
                metadata: { gecko_id: gecko.id, gecko_name: gecko.name, owner_email: ownerEmail },
            }).catch(e => console.error('Failed to notify follower:', e))
        ));
    } catch (error) {
        console.error('Failed to notify followers of new gecko:', error);
    }
}

// Notify all followers when a user creates a new public breeding plan
export async function notifyFollowersNewBreedingPlan(plan, sire, dam, ownerEmail, ownerName) {
    try {
        const followers = await UserFollow.filter({ following_email: ownerEmail });
        const pairName = `${sire?.name || 'Unknown'} × ${dam?.name || 'Unknown'}`;
        await Promise.all(followers.map(follow =>
            Notification.create({
                user_email: follow.follower_email,
                type: 'new_breeding_plan',
                content: `${ownerName || ownerEmail} started a new breeding project: ${pairName}`,
                link: `/PublicProfile?email=${encodeURIComponent(ownerEmail)}`,
                metadata: { plan_id: plan.id, owner_email: ownerEmail },
            }).catch(e => console.error('Failed to notify follower:', e))
        ));
    } catch (error) {
        console.error('Failed to notify followers of new breeding plan:', error);
    }
}

// Notify a user when someone follows them
export async function notifyNewFollower(followedUserEmail, followerEmail, followerName) {
    try {
        await Notification.create({
            user_email: followedUserEmail,
            type: 'new_follower',
            content: `${followerName || followerEmail} started following you!`,
            link: `/PublicProfile?email=${encodeURIComponent(followerEmail)}`,
            metadata: { follower_email: followerEmail },
        });
    } catch (error) {
        console.error('Failed to notify of new follower:', error);
    }
}

// Notify when a user's gecko is selected as Gecko of the Day
export async function notifyGeckoOfTheDay(ownerEmail, geckoName) {
    try {
        await Notification.create({
            user_email: ownerEmail,
            type: 'gecko_of_the_day',
            content: `Your gecko "${geckoName}" was selected as Gecko of the Day!`,
            link: '/Dashboard',
            metadata: { gecko_name: geckoName },
        });
    } catch (error) {
        console.error('Failed to notify gecko of the day:', error);
    }
}

// Notify when a future breeding plan's target window opens
export async function notifyFutureBreedingReady(userEmail, planName, sireName, damName) {
    try {
        await Notification.create({
            user_email: userEmail,
            type: 'future_breeding_ready',
            content: `Your future breeding plan "${planName}" (${sireName} × ${damName}) is now in its target window!`,
            link: '/ProjectManager',
            metadata: { plan_name: planName, sire: sireName, dam: damName },
        });
    } catch (error) {
        console.error('Failed to notify future breeding ready:', error);
    }
}

// Notify a seller about a marketplace inquiry (distinct from regular DMs)
export async function notifyMarketplaceInquiry(sellerEmail, buyerEmail, buyerName, geckoName) {
    try {
        await Notification.create({
            user_email: sellerEmail,
            type: 'marketplace_inquiry',
            content: `${buyerName || buyerEmail} is interested in your gecko "${geckoName}"`,
            link: `/Messages?recipient=${encodeURIComponent(buyerEmail)}`,
            metadata: { buyer_email: buyerEmail, gecko_name: geckoName },
        });
    } catch (error) {
        console.error('Failed to notify marketplace inquiry:', error);
    }
}

// Notify when a user receives a direct message
export async function notifyNewMessage(recipientEmail, senderEmail, senderName, messagePreview) {
    try {
        await Notification.create({
            user_email: recipientEmail,
            type: 'new_message',
            content: `New message from ${senderName || senderEmail}: ${messagePreview.substring(0, 50)}...`,
            link: `/Messages?recipient=${encodeURIComponent(senderEmail)}`,
            metadata: { sender_email: senderEmail },
        });
    } catch (error) {
        console.error('Failed to notify of new message:', error);
    }
}
