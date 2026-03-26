import { createClient } from 'npm:@base44/sdk@0.1.0';
import * as cheerio from 'npm:cheerio@1.0.0-rc.12';

const base44 = createClient({
    appId: Deno.env.get('BASE44_APP_ID'),
});

async function scrapeTikisGeckos(pageNumber = 1) {
    const url = `https://tikisgeckos.com/collections/crested-geckos-1?page=${pageNumber}`;
    console.log(`Scraping page ${pageNumber}`);
    
    try {
        // Set a shorter timeout for each request
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout per page
        
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            console.log(`Page ${pageNumber} returned ${response.status}`);
            return [];
        }

        const html = await response.text();
        const $ = cheerio.load(html);
        const products = [];

        // More targeted selectors for Shopify-based sites like Tiki's
        $('.grid__item .card__content, .product-item, [data-product-handle]').each((i, el) => {
            const $el = $(el);
            
            // Look for title in common Shopify locations
            let title = $el.find('.card__heading a, .product-item__title, h3 a').first().text().trim();
            
            // Look for price in common Shopify locations  
            let priceText = $el.find('.price, .card__price, .money').first().text().trim();
            
            if (title && priceText) {
                const priceMatch = priceText.match(/\$(\d+(?:,\d{3})*(?:\.\d{2})?)/);
                if (priceMatch) {
                    const price = parseFloat(priceMatch[1].replace(/,/g, ''));
                    if (price > 0) {
                        products.push({
                            title: title.toLowerCase(),
                            price,
                            source: 'tikisgeckos'
                        });
                    }
                }
            }
        });

        console.log(`Page ${pageNumber}: ${products.length} products`);
        return products;

    } catch (error) {
        if (error.name === 'AbortError') {
            console.log(`Page ${pageNumber} timed out`);
        } else {
            console.log(`Page ${pageNumber} error: ${error.message}`);
        }
        return [];
    }
}

Deno.serve(async (req) => {
    console.log("Starting Tiki's Geckos price scraping");
    
    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { 
                status: 401, 
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        const token = authHeader.split(' ')[1];
        base44.auth.setToken(token);
        
        const user = await base44.auth.me();
        if (!user || user.role !== 'admin') {
            return new Response(JSON.stringify({ success: false, error: 'Admin access required' }), { 
                status: 403, 
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Clear old cache first
        console.log("Clearing old price cache");
        const oldCache = await base44.entities.MorphPriceCache.list();
        for (const item of oldCache) {
            await base44.entities.MorphPriceCache.delete(item.id);
        }
        
        // Scrape only 2 pages to stay within timeout
        const allProducts = [];
        for (let page = 1; page <= 2; page++) {
            const products = await scrapeTikisGeckos(page);
            allProducts.push(...products);
            
            if (products.length === 0) break;
        }

        console.log(`Total products found: ${allProducts.length}`);

        // Quick morph detection
        const morphKeywords = [
            'flame', 'harlequin', 'pinstripe', 'tiger', 'dalmatian', 
            'patternless', 'bicolor', 'tricolor', 'axanthic', 'cappuccino'
        ];

        const morphPrices = {};
        for (const product of allProducts) {
            for (const morph of morphKeywords) {
                if (product.title.includes(morph)) {
                    if (!morphPrices[morph]) morphPrices[morph] = [];
                    morphPrices[morph].push(product.price);
                }
            }
        }

        // Save price ranges
        let savedCount = 0;
        for (const [morphName, prices] of Object.entries(morphPrices)) {
            if (prices.length > 0) {
                const sortedPrices = prices.sort((a, b) => a - b);
                await base44.entities.MorphPriceCache.create({
                    morph_name: morphName,
                    low_price: sortedPrices[0],
                    high_price: sortedPrices[sortedPrices.length - 1],
                    average_price: Math.round(prices.reduce((sum, p) => sum + p, 0) / prices.length),
                    currency: 'USD',
                    source: 'tikisgeckos.com'
                });
                savedCount++;
            }
        }

        return new Response(JSON.stringify({ 
            success: true, 
            message: `Successfully cached prices for ${savedCount} morphs from ${allProducts.length} products.`,
            morphCount: savedCount,
            productCount: allProducts.length
        }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Scraping failed:', error);
        return new Response(JSON.stringify({ 
            success: false, 
            error: error.message || 'Scraping failed',
            details: 'The scraper may have timed out or the site structure changed.'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
});