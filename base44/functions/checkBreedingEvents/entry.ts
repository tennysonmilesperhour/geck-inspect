import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { addDays, differenceInDays, isSameDay, parseISO } from 'npm:date-fns@3.6.0';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // This function can be called without auth for scheduled jobs
        // Use service role for all operations
        const today = new Date();
        const tomorrow = addDays(today, 1);
        let notificationsCreated = 0;
        const notificationsSent = new Set();

        // 1. Check for OTHER REPTILE feeding reminders
        const allReptiles = await base44.asServiceRole.entities.OtherReptile.list();
        
        for (const reptile of allReptiles) {
            if (!reptile.feeding_reminder_enabled || !reptile.last_fed_date || !reptile.feeding_interval_days) {
                continue;
            }

            const lastFed = parseISO(reptile.last_fed_date);
            const daysSinceLastFed = differenceInDays(today, lastFed);
            const daysUntilNextFeed = reptile.feeding_interval_days - daysSinceLastFed;

            // Send notification if feeding is due today or overdue
            if (daysUntilNextFeed <= 0) {
                const notifKey = `feeding-${reptile.id}-${today.toISOString().split('T')[0]}`;
                if (!notificationsSent.has(notifKey)) {
                    const daysOverdue = Math.abs(daysUntilNextFeed);
                    const message = daysOverdue === 0 
                        ? `${reptile.name} (${reptile.species}) is due for feeding today!`
                        : `${reptile.name} (${reptile.species}) is ${daysOverdue} day(s) overdue for feeding!`;

                    await base44.asServiceRole.entities.Notification.create({
                        user_email: reptile.created_by,
                        type: 'announcement',
                        content: message,
                        link: '/OtherReptiles',
                        metadata: { reptile_id: reptile.id, type: 'feeding_reminder' }
                    });

                    // Send email if user has email notifications enabled
                    if (reptile.feeding_email_enabled) {
                        try {
                            await base44.asServiceRole.integrations.Core.SendEmail({
                                to: reptile.created_by,
                                subject: `Feeding Reminder: ${reptile.name}`,
                                body: `
                                    <h2>Feeding Reminder</h2>
                                    <p>${message}</p>
                                    <p>Log into Geck Inspect to record the feeding.</p>
                                `
                            });
                        } catch (emailError) {
                            console.error("Failed to send email:", emailError);
                        }
                    }

                    notificationsCreated++;
                    notificationsSent.add(notifKey);
                }
            }
            // Send reminder 1 day before feeding is due
            else if (daysUntilNextFeed === 1) {
                const notifKey = `feeding-reminder-${reptile.id}-${today.toISOString().split('T')[0]}`;
                if (!notificationsSent.has(notifKey)) {
                    await base44.asServiceRole.entities.Notification.create({
                        user_email: reptile.created_by,
                        type: 'announcement',
                        content: `Reminder: ${reptile.name} (${reptile.species}) needs feeding tomorrow.`,
                        link: '/OtherReptiles',
                        metadata: { reptile_id: reptile.id, type: 'feeding_reminder' }
                    });
                    notificationsCreated++;
                    notificationsSent.add(notifKey);
                }
            }
        }

        // 2. Check for upcoming egg lay dates
        const plans = await base44.asServiceRole.entities.BreedingPlan.filter({ status: 'Active' });
        for (const plan of plans) {
            if (plan.copulation_events && plan.copulation_events.length > 0) {
                const latestCopulation = plan.copulation_events.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
                const estimatedLayDate = addDays(new Date(latestCopulation.date), 30);

                const notifKey = `lay-${plan.id}-${estimatedLayDate.toISOString().split('T')[0]}`;
                if (isSameDay(estimatedLayDate, tomorrow) && !notificationsSent.has(notifKey)) {
                    const dam = await base44.asServiceRole.entities.Gecko.filter({ id: plan.dam_id });
                    const damName = dam[0]?.name || 'Your gecko';
                    
                    await base44.asServiceRole.entities.Notification.create({
                        user_email: plan.created_by,
                        type: 'announcement',
                        content: `${damName} is expected to lay eggs tomorrow.`,
                        link: '/Breeding',
                        metadata: { plan_id: plan.id, type: 'egg_lay_reminder' }
                    });
                    notificationsCreated++;
                    notificationsSent.add(notifKey);
                }
            }
        }

        // 3. Check for upcoming hatch dates
        const incubatingEggs = await base44.asServiceRole.entities.Egg.filter({ status: 'Incubating' });
        for (const egg of incubatingEggs) {
            if (!egg.hatch_date_expected) continue;
            
            const notifKey = `hatch-${egg.id}`;
            if (isSameDay(new Date(egg.hatch_date_expected), tomorrow) && !notificationsSent.has(notifKey)) {
                const plan = await base44.asServiceRole.entities.BreedingPlan.filter({ id: egg.breeding_plan_id });
                if (plan[0]) {
                    const sire = await base44.asServiceRole.entities.Gecko.filter({ id: plan[0].sire_id });
                    const dam = await base44.asServiceRole.entities.Gecko.filter({ id: plan[0].dam_id });
                    const sireName = sire[0]?.name || 'Sire';
                    const damName = dam[0]?.name || 'Dam';
                    
                    await base44.asServiceRole.entities.Notification.create({
                        user_email: egg.created_by,
                        type: 'announcement',
                        content: `An egg from pairing ${sireName} x ${damName} is expected to hatch tomorrow!`,
                        link: '/Breeding',
                        metadata: { egg_id: egg.id, type: 'hatch_reminder' }
                    });
                    notificationsCreated++;
                    notificationsSent.add(notifKey);
                }
            }
        }
        
        return Response.json({ 
            success: true,
            message: `Process complete. ${notificationsCreated} notifications created.`,
            notificationsCreated 
        });

    } catch (error) {
        console.error("Error in checkBreedingEvents function:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});