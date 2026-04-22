import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('BASE44_SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('BASE44_SUPABASE_SERVICE_ROLE_KEY');
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:support@geckinspect.com';

    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(
        JSON.stringify({ error: 'VAPID keys not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    const supabase = createClient(supabaseUrl!, serviceRoleKey!);

    const { user_email, title, body, url, tag, notification_id } = await req.json();

    if (!user_email) {
      return new Response(
        JSON.stringify({ error: 'user_email is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has push enabled in their profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('push_notifications_enabled')
      .eq('email', user_email)
      .maybeSingle();

    if (profile && profile.push_notifications_enabled === false) {
      return new Response(
        JSON.stringify({ skipped: true, reason: 'Push notifications disabled by user' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { data: subscriptions, error: fetchError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_email', user_email);

    if (fetchError) {
      console.error('Failed to fetch subscriptions:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch subscriptions' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ skipped: true, reason: 'No push subscriptions for user' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const payload = JSON.stringify({
      title: title || 'Geck Inspect',
      body: body || '',
      url: url || '/Notifications',
      tag: tag || 'geck-inspect',
      notificationId: notification_id,
    });

    const results = [];
    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
          },
          payload
        );
        results.push({ endpoint: sub.endpoint, status: 'sent' });
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id);
          results.push({ endpoint: sub.endpoint, status: 'expired_removed' });
        } else {
          console.error('Push send error:', err.statusCode, err.message);
          results.push({ endpoint: sub.endpoint, status: 'failed', error: err.message });
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('sendPushNotification error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
