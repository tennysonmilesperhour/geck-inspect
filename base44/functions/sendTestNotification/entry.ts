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
        if (!user || user.role !== 'admin') {
            return new Response('Unauthorized - Admin only', { status: 403 });
        }

        const { recipient_email } = await req.json();

        if (!recipient_email) {
            return new Response('Recipient email is required', { status: 400 });
        }

        // Create a test notification in the database
        const notification = await base44.entities.Notification.create({
            user_email: recipient_email,
            type: 'announcement',
            content: 'Test notification: This is a test notification sent from the admin panel. The notification system is working correctly!',
            is_read: false,
            link: '/notifications',
            metadata: {
                test: true,
                sent_by: user.email,
                sent_at: new Date().toISOString()
            }
        });

        return new Response(JSON.stringify({ 
            success: true, 
            message: 'Test notification created successfully and should appear in the user\'s notification bell',
            notification_id: notification.id,
            recipient: recipient_email
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error sending test notification:', error);
        return new Response(JSON.stringify({ 
            success: false, 
            error: error.message 
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
});