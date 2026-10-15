import { Notification, UserFollow, Gecko } from '@/entities/all';

// Email + push fanout happens inside Postgres: a trigger on the
// `notifications` table calls the send-push and send-email edge
// functions on every insert (see
// supabase/migrations/20260507225002_notifications_send_push_trigger.sql
// and 20260422210000_notifications_send_email_trigger.sql). The client
// only needs to insert the row, no client-side SendEmail or per-user
// preference lookup. The trigger reads the recipient's preferences and
// skips channels the user has disabled.
//
// Notifications to another member (messages, forum replies, new listings
// for followers) are checked by the database: it confirms the message,
// comment or follow exists and writes the words and the link itself from a
// fixed template with the sender's display name (migration
// 20261015130000_comms_and_exposure). Whatever content or link is sent
// from here for those is replaced, so these helpers send only the type,
// the recipient and the ids the template needs. Follows notify from the
// database (follow_profile), so there is no follower helper here.

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
                content: `${ownerName || 'A breeder you follow'} listed a new gecko`,
                link: '/',
                metadata: { gecko_id: gecko.id },
            }).catch(e => console.error('Failed to notify follower:', e))
        ));
    } catch (error) {
        console.error('Failed to notify followers of new gecko:', error);
    }
}

// Notify all followers when a user creates a new public breeding plan
// Decision D18: only a public plan is announced to followers. A private
// plan (the default) never leaves the breeder's account.
export async function notifyFollowersNewBreedingPlan(plan, sire, dam, ownerEmail, ownerName) {
    if (plan?.is_public !== true) return;
    try {
        const followers = await UserFollow.filter({ following_email: ownerEmail });
        const pairName = `${sire?.name || 'Unknown'} × ${dam?.name || 'Unknown'}`;
        await Promise.all(followers.map(follow =>
            Notification.create({
                user_email: follow.follower_email,
                type: 'new_breeding_plan',
                content: `${ownerName || 'A breeder you follow'} started a new breeding project: ${pairName}`,
                link: '/',
                metadata: { plan_id: plan.id },
            }).catch(e => console.error('Failed to notify follower:', e))
        ));
    } catch (error) {
        console.error('Failed to notify followers of new breeding plan:', error);
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

// A future breeding plan's target window is announced by the server
// (enqueue_season_planner_reminders). Since 15 Oct 2026 the database
// refuses that type from the browser, so there is no helper for it here.

// Notify when a user receives a direct message
export async function notifyNewMessage(recipientEmail, senderEmail, senderName) {
    try {
        // The database writes "<name> sent you a message." and the link to
        // the conversation; the message text itself never goes in an email.
        await Notification.create({
            user_email: recipientEmail,
            type: 'new_message',
            content: `${senderName || 'A member'} sent you a message.`,
            link: `/Messages?recipient=${encodeURIComponent(senderEmail)}`,
        });
    } catch (error) {
        console.error('Failed to notify of new message:', error);
    }
}
