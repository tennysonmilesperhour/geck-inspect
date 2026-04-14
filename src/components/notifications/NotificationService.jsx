import { Notification, UserFollow, User, Gecko } from '@/entities/all';
import { SendEmail } from '@/integrations/Core';

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
        // Get all followers of this user
        const followers = await UserFollow.filter({ following_email: ownerEmail });
        
        for (const follow of followers) {
            try {
                // Get follower's notification preferences
                const [followerUser] = await User.filter({ email: follow.follower_email });
                
                if (followerUser?.notifications_following_activity !== false) {
                    // Create notification
                    await Notification.create({
                        user_email: follow.follower_email,
                        type: 'new_gecko_listing',
                        content: `${ownerName || ownerEmail} listed a new gecko: ${gecko.name}`,
                        link: `/PublicProfile?email=${encodeURIComponent(ownerEmail)}`,
                        metadata: { gecko_id: gecko.id, gecko_name: gecko.name, owner_email: ownerEmail }
                    });
                    
                    // Send email if enabled
                    if (followerUser?.email_on_following_activity && followerUser?.notifications_email) {
                        await SendEmail({
                            to: follow.follower_email,
                            subject: `${ownerName || 'A breeder you follow'} listed a new gecko!`,
                            body: `${ownerName || ownerEmail} just listed a new gecko: ${gecko.name}\n\nCheck it out on Geck Inspect!`
                        }).catch(e => console.log('Email send failed:', e));
                    }
                }
            } catch (e) {
                console.error('Failed to notify follower:', e);
            }
        }
    } catch (error) {
        console.error('Failed to notify followers of new gecko:', error);
    }
}

// Notify all followers when a user creates a new public breeding plan
export async function notifyFollowersNewBreedingPlan(plan, sire, dam, ownerEmail, ownerName) {
    
    try {
        const followers = await UserFollow.filter({ following_email: ownerEmail });
        
        for (const follow of followers) {
            try {
                const [followerUser] = await User.filter({ email: follow.follower_email });
                
                if (followerUser?.notifications_following_activity !== false) {
                    const pairName = `${sire?.name || 'Unknown'} × ${dam?.name || 'Unknown'}`;
                    
                    await Notification.create({
                        user_email: follow.follower_email,
                        type: 'new_breeding_plan',
                        content: `${ownerName || ownerEmail} started a new breeding project: ${pairName}`,
                        link: `/PublicProfile?email=${encodeURIComponent(ownerEmail)}`,
                        metadata: { plan_id: plan.id, owner_email: ownerEmail }
                    });
                    
                    if (followerUser?.email_on_following_activity && followerUser?.notifications_email) {
                        await SendEmail({
                            to: follow.follower_email,
                            subject: `${ownerName || 'A breeder you follow'} started a new breeding project!`,
                            body: `${ownerName || ownerEmail} just started breeding ${pairName}\n\nCheck it out on Geck Inspect!`
                        }).catch(e => console.log('Email send failed:', e));
                    }
                }
            } catch (e) {
                console.error('Failed to notify follower:', e);
            }
        }
    } catch (error) {
        console.error('Failed to notify followers of new breeding plan:', error);
    }
}

// Notify a user when someone follows them
export async function notifyNewFollower(followedUserEmail, followerEmail, followerName) {
    try {
        const [followedUser] = await User.filter({ email: followedUserEmail });
        
        if (followedUser?.notifications_follows !== false) {
            await Notification.create({
                user_email: followedUserEmail,
                type: 'new_follower',
                content: `${followerName || followerEmail} started following you!`,
                link: `/PublicProfile?email=${encodeURIComponent(followerEmail)}`,
                metadata: { follower_email: followerEmail }
            });
            
            if (followedUser?.email_on_new_follower && followedUser?.notifications_email) {
                await SendEmail({
                    to: followedUserEmail,
                    subject: `You have a new follower on Geck Inspect!`,
                    body: `${followerName || followerEmail} just started following you!\n\nCheck out their profile on Geck Inspect.`
                }).catch(e => console.log('Email send failed:', e));
            }
        }
    } catch (error) {
        console.error('Failed to notify of new follower:', error);
    }
}

// Notify when a user reaches a gecko milestone (level_up)
export async function notifyLevelUp(userEmail, newLevel, geckoCount) {
    try {
        await Notification.create({
            user_email: userEmail,
            type: 'level_up',
            content: `Congratulations! You've reached ${newLevel} status with ${geckoCount} geckos in your collection!`,
            link: '/MyGeckos',
            metadata: { level: newLevel, gecko_count: geckoCount }
        });
    } catch (error) {
        console.error('Failed to notify level up:', error);
    }
}

// Notify when a user's gecko is selected as Gecko of the Day
export async function notifyGeckoOfTheDay(ownerEmail, geckoName) {
    try {
        const [owner] = await User.filter({ email: ownerEmail });
        await Notification.create({
            user_email: ownerEmail,
            type: 'gecko_of_the_day',
            content: `Your gecko "${geckoName}" was selected as Gecko of the Day!`,
            link: '/Dashboard',
            metadata: { gecko_name: geckoName }
        });
        if (owner?.notifications_email) {
            await SendEmail({
                to: ownerEmail,
                subject: `Your gecko "${geckoName}" is Gecko of the Day!`,
                body: `Congratulations! Your gecko "${geckoName}" was featured as Gecko of the Day on Geck Inspect!\n\nCheck it out on your dashboard!`
            }).catch(e => console.log('Email send failed:', e));
        }
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
            metadata: { plan_name: planName, sire: sireName, dam: damName }
        });
    } catch (error) {
        console.error('Failed to notify future breeding ready:', error);
    }
}

// Notify a seller about a marketplace inquiry (distinct from regular DMs)
export async function notifyMarketplaceInquiry(sellerEmail, buyerEmail, buyerName, geckoName) {
    try {
        const [seller] = await User.filter({ email: sellerEmail });
        if (seller?.notifications_messages !== false) {
            await Notification.create({
                user_email: sellerEmail,
                type: 'marketplace_inquiry',
                content: `${buyerName || buyerEmail} is interested in your gecko "${geckoName}"`,
                link: `/Messages?recipient=${encodeURIComponent(buyerEmail)}`,
                metadata: { buyer_email: buyerEmail, gecko_name: geckoName }
            });
            if (seller?.email_on_new_message && seller?.notifications_email) {
                await SendEmail({
                    to: sellerEmail,
                    subject: `Someone is interested in your gecko "${geckoName}"`,
                    body: `${buyerName || buyerEmail} sent you a marketplace inquiry about "${geckoName}" on Geck Inspect!\n\nLog in to reply!`
                }).catch(e => console.log('Email send failed:', e));
            }
        }
    } catch (error) {
        console.error('Failed to notify marketplace inquiry:', error);
    }
}

// Notify when a user receives a direct message
export async function notifyNewMessage(recipientEmail, senderEmail, senderName, messagePreview) {
    try {
        const [recipient] = await User.filter({ email: recipientEmail });
        
        if (recipient?.notifications_messages !== false) {
            await Notification.create({
                user_email: recipientEmail,
                type: 'new_message',
                content: `New message from ${senderName || senderEmail}: ${messagePreview.substring(0, 50)}...`,
                link: `/Messages?recipient=${encodeURIComponent(senderEmail)}`,
                metadata: { sender_email: senderEmail }
            });
            
            if (recipient?.email_on_new_message && recipient?.notifications_email) {
                await SendEmail({
                    to: recipientEmail,
                    subject: `New message from ${senderName || senderEmail}`,
                    body: `You received a new message on Geck Inspect:\n\n"${messagePreview.substring(0, 200)}${messagePreview.length > 200 ? '...' : ''}"\n\nLog in to reply!`
                }).catch(e => console.log('Email send failed:', e));
            }
        }
    } catch (error) {
        console.error('Failed to notify of new message:', error);
    }
}