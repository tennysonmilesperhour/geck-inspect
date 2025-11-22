import { createClientFromRequest } from 'npm:@base44/sdk@0.5.0';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        if (!(await base44.auth.isAuthenticated())) {
            return new Response('Unauthorized', { status: 401 });
        }
        
        const user = await base44.auth.me();
        const { geckoId, certificateType } = await req.json();

        // Fetch all of the user's geckos at once for efficiency
        const allGeckos = await base44.entities.Gecko.filter({ created_by: user.email });
        if (!allGeckos || allGeckos.length === 0) {
            return new Response('No geckos found for user', { status: 404 });
        }
        
        const getFullGecko = (id) => allGeckos.find(g => g.id === id);

        const geckoData = getFullGecko(geckoId);
        if (!geckoData) {
            return new Response('Gecko not found or does not belong to user', { status: 404 });
        }

        // --- Ancestor and Image Data ---
        const defaultImage = 'https://i.imgur.com/sw9gnDp.png';
        const geckoImage = geckoData.image_urls?.[0] || defaultImage;
        const sire = getFullGecko(geckoData.sire_id);
        const dam = getFullGecko(geckoData.dam_id);
        const sireImage = sire?.image_urls?.[0] || defaultImage;
        const damImage = dam?.image_urls?.[0] || defaultImage;

        const grandsire_s = sire ? getFullGecko(sire.sire_id) : null;
        const granddam_s = sire ? getFullGecko(sire.dam_id) : null;
        const grandsire_d = dam ? getFullGecko(dam.sire_id) : null;
        const granddam_d = dam ? getFullGecko(dam.dam_id) : null;
        
        const gs_s_img = grandsire_s?.image_urls?.[0] || defaultImage;
        const gd_s_img = granddam_s?.image_urls?.[0] || defaultImage;
        const gs_d_img = grandsire_d?.image_urls?.[0] || defaultImage;
        const gd_d_img = granddam_d?.image_urls?.[0] || defaultImage;
        
        const verificationUrl = `${req.headers.get('origin')}/PublicProfile?userId=${user.id}`;
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent(verificationUrl)}`;

        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>${certificateType === 'lineage' ? 'Lineage' : 'Ownership'} Certificate - ${geckoData.name}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Roboto:wght@400;500&display=swap');
                body { font-family: 'Roboto', sans-serif; margin: 0; padding: 20px; background: #f0f2f0; color: #333; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
                .container { max-width: 800px; margin: auto; border: 1px solid #ddd; background: white; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
                .inner-border { border: 6px double #566B5F; padding: 25px; }
                .header { text-align: center; margin-bottom: 30px; }
                .logo { font-family: 'Playfair Display', serif; font-size: 28px; font-weight: bold; color: #566B5F; letter-spacing: 1px; }
                .cert-title { font-size: 18px; color: #333; margin-top: 5px; text-transform: uppercase; letter-spacing: 3px; }
                .section { margin-bottom: 25px; }
                .section-title { font-size: 16px; font-weight: bold; color: #fff; background-color: #566B5F; padding: 6px 12px; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 1px; }
                .main-gecko-info { display: flex; gap: 25px; align-items: center; }
                .main-gecko-img { width: 180px; height: 180px; object-fit: cover; border-radius: 4px; border: 4px solid #e1e5e1; }
                .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
                .info-item { line-height: 1.4; }
                .label { font-size: 11px; color: #777; text-transform: uppercase; }
                .value { font-size: 15px; font-weight: 500; }
                .lineage-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; text-align: center; }
                .ancestor-card { font-size: 12px; }
                .ancestor-img { width: 100%; height: 100px; object-fit: cover; border-radius: 4px; margin-bottom: 5px; border: 1px solid #eee; }
                .ancestor-name { font-weight: bold; }
                .ancestor-id { font-size: 10px; color: #666; }
                .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 11px; color: #888; display: flex; justify-content: space-between; align-items: center; }
                .print-button { position: fixed; bottom: 20px; right: 20px; padding: 10px 20px; background: #566B5F; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; box-shadow: 0 4px 8px rgba(0,0,0,0.2); }
                @media print {
                    body { background: white; }
                    .print-button { display: none; }
                    .container { box-shadow: none; border: none; }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="inner-border">
                    <div class="header">
                        <div class="logo">GECK INSPECT</div>
                        <div class="cert-title">Certificate of ${certificateType === 'lineage' ? 'Lineage' : 'Ownership'}</div>
                    </div>
                    
                    <div class="section">
                        <div class="section-title">Subject Information</div>
                        <div class="main-gecko-info">
                            <img src="${geckoImage}" class="main-gecko-img" alt="${geckoData.name}">
                            <div style="flex: 1;">
                                <h2 style="font-size: 24px; margin: 0 0 15px 0;">${geckoData.name}</h2>
                                <div class="info-grid">
                                    <div class="info-item"><div class="label">ID</div><div class="value">${geckoData.gecko_id_code || 'N/A'}</div></div>
                                    <div class="info-item"><div class="label">Sex</div><div class="value">${geckoData.sex}</div></div>
                                    <div class="info-item"><div class="label">Hatch Date</div><div class="value">${geckoData.hatch_date ? new Date(geckoData.hatch_date).toLocaleDateString() : 'Unknown'}</div></div>
                                    <div class="info-item"><div class="label">Species</div><div class="value">C. ciliatus</div></div>
                                </div>
                                <div class="info-item" style="margin-top: 12px;"><div class="label">Morphs & Traits</div><div class="value">${geckoData.morphs_traits || 'Not specified'}</div></div>
                            </div>
                        </div>
                    </div>
                    
                    ${certificateType === 'lineage' ? `
                    <div class="section">
                        <div class="section-title">Parentage</div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                            <div>
                                <h4 style="margin: 0 0 10px 0;">Sire (Father)</h4>
                                <div style="display: flex; align-items: center; gap: 15px;">
                                    <img src="${sireImage}" alt="${sire?.name || 'Unknown'}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 4px;">
                                    <div>
                                        <div class="ancestor-name">${sire?.name || 'Unknown'}</div>
                                        <div class="ancestor-id">ID: ${sire?.gecko_id_code || 'N/A'}</div>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <h4 style="margin: 0 0 10px 0;">Dam (Mother)</h4>
                                <div style="display: flex; align-items: center; gap: 15px;">
                                    <img src="${damImage}" alt="${dam?.name || 'Unknown'}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 4px;">
                                    <div>
                                        <div class="ancestor-name">${dam?.name || 'Unknown'}</div>
                                        <div class="ancestor-id">ID: ${dam?.gecko_id_code || 'N/A'}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="section">
                        <div class="section-title">Grandparentage</div>
                        <div class="lineage-grid">
                            <div class="ancestor-card">
                                <img src="${gs_s_img}" class="ancestor-img" alt="Paternal Grandsire"><div class="label">Paternal Grandsire</div>
                                <div class="ancestor-name">${grandsire_s?.name || 'Unknown'}</div><div class="ancestor-id">${grandsire_s?.gecko_id_code || ''}</div>
                            </div>
                            <div class="ancestor-card">
                                <img src="${gd_s_img}" class="ancestor-img" alt="Paternal Granddam"><div class="label">Paternal Granddam</div>
                                <div class="ancestor-name">${granddam_s?.name || 'Unknown'}</div><div class="ancestor-id">${granddam_s?.gecko_id_code || ''}</div>
                            </div>
                            <div class="ancestor-card">
                                <img src="${gs_d_img}" class="ancestor-img" alt="Maternal Grandsire"><div class="label">Maternal Grandsire</div>
                                <div class="ancestor-name">${grandsire_d?.name || 'Unknown'}</div><div class="ancestor-id">${grandsire_d?.gecko_id_code || ''}</div>
                            </div>
                            <div class="ancestor-card">
                                <img src="${gd_d_img}" class="ancestor-img" alt="Maternal Granddam"><div class="label">Maternal Granddam</div>
                                <div class="ancestor-name">${granddam_d?.name || 'Unknown'}</div><div class="ancestor-id">${granddam_d?.gecko_id_code || ''}</div>
                            </div>
                        </div>
                    </div>
                    ` : `
                    <div class="section">
                        <div class="section-title">Breeder Information</div>
                        <div class="info-grid">
                            <div class="info-item"><div class="label">Breeder Name</div><div class="value">${user.breeder_name || user.full_name}</div></div>
                            <div class="info-item"><div class="label">Contact Email</div><div class="value">${user.email_contact || user.email}</div></div>
                            ${user.phone_contact ? `<div class="info-item"><div class="label">Phone</div><div class="value">${user.phone_contact}</div></div>` : ''}
                            ${user.website_url ? `<div class="info-item"><div class="label">Website</div><div class="value">${user.website_url}</div></div>` : ''}
                        </div>
                         ${user.business_address ? `<div class="info-item" style="margin-top: 12px;"><div class="label">Address</div><div class="value">${user.business_address}</div></div>` : ''}
                    </div>
                    `}
                    
                    <div class="footer">
                        <div class="qr-code">
                            <img src="${qrCodeUrl}" alt="QR Code">
                            <p style="margin-top: 5px;">Scan to Verify Breeder</p>
                        </div>
                        <div style="text-align: right;">
                            <p>Generated by Geck Inspect on ${new Date().toLocaleDateString()}</p>
                            <p>Certificate ID: CERT-${geckoId.substring(0, 8).toUpperCase()}</p>
                        </div>
                    </div>
                </div>
            </div>
            <button class="print-button" onclick="window.print()">Print Certificate</button>
        </body>
        </html>
        `;

        return new Response(htmlContent, {
            status: 200,
            headers: {
                'Content-Type': 'text/html',
            }
        });

    } catch (error) {
        console.error('Error generating certificate:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
});