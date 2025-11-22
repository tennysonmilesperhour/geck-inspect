import { createClientFromRequest } from 'npm:@base44/sdk@0.5.0';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.role !== 'admin') {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403 });
        }

        const { target_group, subject, content } = await req.json();

        if (!target_group || !subject || !content) {
            return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
        }

        let targetUsers = [];
        const allUsers = await base44.asServiceRole.entities.User.list();

        switch (target_group) {
            case 'all':
                targetUsers = allUsers;
                break;
            case 'experts':
                targetUsers = allUsers.filter(u => u.is_expert);
                break;
            case 'admins':
                targetUsers = allUsers.filter(u => u.role === 'admin');
                break;
            case 'non_experts':
                targetUsers = allUsers.filter(u => !u.is_expert);
                break;
            default:
                return new Response(JSON.stringify({ error: 'Invalid target group' }), { status: 400 });
        }

        if (targetUsers.length === 0) {
            return new Response(JSON.stringify({ message: 'No users found in the target group.', sent_count: 0 }), { status: 200 });
        }

        const notifications = targetUsers.map(targetUser => ({
            user_email: targetUser.email,
            type: 'announcement',
            content: subject,
            link: '/messages',
            metadata: { full_content: content }
        }));
        
        const messages = targetUsers.map(targetUser => ({
            sender_email: 'system@geckinspect.com',
            recipient_email: targetUser.email,
            content: `**${subject}**\n\n${content}`,
            message_type: 'system'
        }));

        await Promise.all([
            base44.asServiceRole.entities.Notification.bulkCreate(notifications),
            base44.asServiceRole.entities.DirectMessage.bulkCreate(messages)
        ]);

        return new Response(JSON.stringify({ 
            message: 'Mass message sent successfully.', 
            sent_count: targetUsers.length 
        }), { status: 200 });

    } catch (error) {
        console.error('Error sending mass message:', error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
});