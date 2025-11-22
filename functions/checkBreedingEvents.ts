import { createClient } from 'npm:@base44/sdk@0.1.0';
import { addDays, isSameDay } from 'npm:date-fns@3.6.0';

const base44 = createClient({ appId: Deno.env.get('BASE44_APP_ID') });

Deno.serve(async (req) => {
    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
        }
        const token = authHeader.split(' ')[1];
        base44.auth.setToken(token);
        const user = await base44.auth.me();
        if (!user || user.role !== 'admin') {
            return new Response(JSON.stringify({ error: 'Forbidden: Admin access required' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
        }

        const today = new Date();
        const tomorrow = addDays(today, 1);
        let notificationsCreated = 0;
        const notificationsSent = new Set(); // To avoid duplicate notifications

        // 1. Check for upcoming egg lay dates
        const plans = await base44.entities.BreedingPlan.filter({ status: 'Active' });
        for (const plan of plans) {
            if (plan.copulation_events && plan.copulation_events.length > 0) {
                const latestCopulation = plan.copulation_events.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
                const estimatedLayDate = addDays(new Date(latestCopulation.date), 30);

                const notifKey = `lay-${plan.id}-${estimatedLayDate.toISOString().split('T')[0]}`;
                if (isSameDay(estimatedLayDate, tomorrow) && !notificationsSent.has(notifKey)) {
                    const dam = await base44.entities.Gecko.get(plan.dam_id);
                    await base44.entities.Notification.create({
                        user_email: plan.created_by,
                        type: 'announcement', // Using general type for now
                        content: `Your gecko ${dam.name} is expected to lay eggs tomorrow.`,
                        link: '/Breeding'
                    });
                    notificationsCreated++;
                    notificationsSent.add(notifKey);
                }
            }
        }

        // 2. Check for upcoming hatch dates
        const incubatingEggs = await base44.entities.Egg.filter({ status: 'Incubating' });
        for (const egg of incubatingEggs) {
            const notifKey = `hatch-${egg.id}`;
            if (isSameDay(new Date(egg.hatch_date_expected), tomorrow) && !notificationsSent.has(notifKey)) {
                const plan = await base44.entities.BreedingPlan.get(egg.breeding_plan_id);
                const sire = await base44.entities.Gecko.get(plan.sire_id);
                const dam = await base44.entities.Gecko.get(plan.dam_id);
                await base44.entities.Notification.create({
                    user_email: egg.created_by,
                    type: 'announcement',
                    content: `An egg from pairing ${sire.name} x ${dam.name} is expected to hatch tomorrow!`,
                    link: '/Breeding'
                });
                notificationsCreated++;
                notificationsSent.add(notifKey);
            }
        }
        
        return new Response(JSON.stringify({ message: `Process complete. ${notificationsCreated} notifications created.` }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error("Error in checkBreedingEvents function:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
});