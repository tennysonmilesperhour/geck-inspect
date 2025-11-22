import { createClientFromRequest } from 'npm:@base44/sdk@0.5.0';
import { format } from "npm:date-fns";

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Use service role for automated selection
        const today = format(new Date(), 'yyyy-MM-dd');
        
        const existing = await base44.asServiceRole.entities.GeckoOfTheDay.filter({ date: today });
        if (existing && existing.length > 0) {
            return new Response(JSON.stringify({ message: "Gecko of the Day already selected for today." }), {
                status: 200, headers: { 'Content-Type': 'application/json' }
            });
        }
        
        const allImages = await base44.asServiceRole.entities.GeckoImage.list();
        if (!allImages || allImages.length === 0) {
            return new Response(JSON.stringify({ message: "No gecko images available to choose from." }), {
                status: 200, headers: { 'Content-Type': 'application/json' }
            });
        }

        const randomImage = allImages[Math.floor(Math.random() * allImages.length)];

        // Enhanced appreciative message generation
        const morphName = randomImage.primary_morph.replace(/_/g, ' ');
        const messages = [
            `What a stunning example of a ${morphName}! The colors and patterns are absolutely incredible.`,
            `Look at this gorgeous ${morphName}! The structure and vibrant colors make this a perfect representative of the morph.`,
            `Amazing ${morphName} with fantastic coloration! This is exactly the kind of quality gecko our community loves to see.`,
            `Incredible ${morphName}! The pattern definition and color saturation on this gecko are simply outstanding.`,
            `Beautiful ${morphName} showcasing all the best traits of this morph. What a fantastic addition to our community gallery!`
        ];
        const appreciativeMessage = messages[Math.floor(Math.random() * messages.length)];
        
        const uploaderEmail = randomImage.created_by;

        const newGeckoOfTheDay = await base44.asServiceRole.entities.GeckoOfTheDay.create({
            date: today,
            gecko_image_id: randomImage.id,
            appreciative_message: appreciativeMessage,
            uploader_email: uploaderEmail,
            notification_sent: false
        });

        if (uploaderEmail) {
            await base44.asServiceRole.entities.Notification.create({
                user_email: uploaderEmail,
                type: 'gecko_of_day',
                content: `🎉 Congratulations! Your ${morphName} gecko has been featured as Gecko of the Day!`,
                link: `/GeckoDetail?id=${randomImage.id}`
            });
            await base44.asServiceRole.entities.GeckoOfTheDay.update(newGeckoOfTheDay.id, { notification_sent: true });
        }
        
        return new Response(JSON.stringify({ success: true, gecko: newGeckoOfTheDay }), {
            status: 200, headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error("Error selecting Gecko of the Day:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }
});