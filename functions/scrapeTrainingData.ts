import { createClientFromRequest } from 'npm:@base44/sdk@0.5.0';
import { DOMParser, Element } from "https://deno.land/x/deno_dom@v0.1.45/deno-dom-wasm.ts";

const knownImageHosts = [
    'cdn.morphmarket.com',
    'i.imgur.com',
    // Add other known reputable hosts to prevent scraping random site images
];

async function scrapeMorphMarketPage(doc, base44) {
    const results = [];
    const animalCards = doc.querySelectorAll('.animalCard');
    
    for (const card of animalCards) {
        try {
            const imageUrl = card.querySelector('.animalCard-image-img')?.getAttribute('src');
            const traitsText = card.querySelector('.animalCard-traits')?.textContent.trim();
            const storeLink = card.querySelector('.animalCard-storeName a')?.textContent.trim();

            if (imageUrl && traitsText && knownImageHosts.some(host => imageUrl.includes(host))) {
                const existing = await base44.asServiceRole.entities.ScrapedTrainingData.filter({ image_url: imageUrl });
                if (existing.length === 0) {
                    results.push({
                        image_url: imageUrl,
                        primary_morph: traitsText.split(',')[0].trim(),
                        secondary_traits: traitsText.split(',').slice(1).map(t => t.trim()),
                        description: `Traits: ${traitsText}. From store: ${storeLink}`,
                        source_website: 'MorphMarket',
                        status: 'pending_review',
                    });
                }
            }
        } catch (e) {
            console.error("Error scraping a card:", e.message);
        }
    }
    return results;
}

function findNextPageUrl(doc, currentUrl) {
    const nextLink = doc.querySelector('a[aria-label="Next Page"]');
    if (nextLink) {
        const href = nextLink.getAttribute('href');
        if (href) {
            return new URL(href, currentUrl).href;
        }
    }
    return null;
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (user?.role !== 'admin') {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
        }

        const { maxImages = 50, customUrls = [], autoPaginate = true } = await req.json();

        let urlsToVisit = customUrls.length > 0 ? customUrls : ['https://www.morphmarket.com/us/c/reptiles/lizards/crested-geckos'];
        const visitedUrls = new Set();
        let allScrapedData = [];
        let pagesScraped = 0;
        const MAX_PAGES = 20; // Safety limit for pagination

        while (urlsToVisit.length > 0 && allScrapedData.length < maxImages && pagesScraped < MAX_PAGES) {
            const currentUrl = urlsToVisit.shift();
            if (visitedUrls.has(currentUrl)) continue;

            visitedUrls.add(currentUrl);
            pagesScraped++;
            
            try {
                const response = await fetch(currentUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                if (!response.ok) continue;

                const html = await response.text();
                const doc = new DOMParser().parseFromString(html, "text/html");
                if (!doc) continue;

                let pageResults = [];
                if (currentUrl.includes('morphmarket.com')) {
                    pageResults = await scrapeMorphMarketPage(doc, base44);
                }
                // Add else-if blocks for other site-specific scrapers here

                allScrapedData.push(...pageResults);

                if (autoPaginate) {
                    const nextPageUrl = findNextPageUrl(doc, currentUrl);
                    if (nextPageUrl && !visitedUrls.has(nextPageUrl)) {
                        urlsToVisit.push(nextPageUrl);
                    }
                }
            } catch (pageError) {
                console.error(`Failed to scrape page ${currentUrl}:`, pageError.message);
            }
        }
        
        if (allScrapedData.length > 0) {
            await base44.asServiceRole.entities.ScrapedTrainingData.bulkCreate(allScrapedData);
        }

        return new Response(JSON.stringify({ 
            message: "Scraping complete.",
            scrapedCount: allScrapedData.length 
        }), { status: 200 });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
});