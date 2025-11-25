import { Notification, UserFollow, User } from '@/entities/all';
import { SendEmail } from '@/integrations/Core';

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
    if (!plan.is_public) return;
    
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