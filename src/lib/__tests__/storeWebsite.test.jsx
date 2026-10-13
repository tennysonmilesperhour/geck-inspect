import { afterAll, describe, expect, it, vi } from 'vitest';
vi.hoisted(() => vi.stubGlobal('window', { self: null, top: null }));
afterAll(() => vi.unstubAllGlobals());
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { normalizeWebsite, normalizeContactUrl, safeWebsiteUrl, WEBSITE_SECTIONS, websitePalette } from '../storeWebsite';
import { applyStoreSettings, readStoreSettings, publicExternalLinks } from '@/components/storefront/StorefrontSections';
import StorefrontWebsite from '@/components/storefront/StorefrontWebsite';

const custom = { id: 'custom-care', title: 'Raised with care', body: 'Daily care notes', imageUrl: 'https://example.com/photo.jpg', visible: true };
const render = props => renderToStaticMarkup(<MemoryRouter><StorefrontWebsite {...props} /></MemoryRouter>);

describe('website settings compatibility', () => {
  it('round-trips customization through the existing save normalization and JSON carrier', () => {
    const links = [{ kind: 'instagram', label: 'Instagram', url: 'https://instagram.com/fixture' }];
    const settings = { theme: 'violet', showAvailable: false, waitlistId: 'wl-1', website: normalizeWebsite({
      mode: 'light', accent: '#ffcc00', font: 'editorial', heroLayout: 'split', sections: [custom, { id: 'about', title: 'Our story', visible: false }],
    }) };
    const saved = applyStoreSettings(links, settings);
    // MyStore used to drop the value property when normalizing links.
    const urlOnly = JSON.parse(JSON.stringify(saved)).map(({ value: _value, ...rest }) => rest);
    expect(readStoreSettings(urlOnly)).toEqual(settings);
    expect(publicExternalLinks(saved)).toEqual(links);
    expect(applyStoreSettings(saved, settings)).toEqual(saved);
    expect(saved.filter(x => x.kind === '_website')).toHaveLength(1);
  });
  it('loads older stores and malformed settings without breaking the site', () => {
    expect(readStoreSettings([{ kind: '_theme', url: 'geck:amber' }]).theme).toBe('amber');
    expect(readStoreSettings([{ kind: '_website', url: 'geck:{broken' }]).website.version).toBe(1);
    expect(normalizeWebsite(null).sections.map(s => s.id)).toEqual(WEBSITE_SECTIONS.map(([id]) => id));
  });
  it('bounds malformed values and strips executable data', () => {
    const result = normalizeWebsite({ accent: 'url(javascript:alert(1))', radius: 999, heroHeight: -5,
      font: 'evil', columns: NaN, sections: [custom, custom, ...Array.from({ length: 20 }, (_, i) => ({ id: `custom-${i}` }))], logoUrl: 'javascript:alert(1)' });
    expect(result.accent).toBe(''); expect(result.logoUrl).toBe('');
    expect(result.radius).toBe(32); expect(result.heroHeight).toBe(280); expect(result.columns).toBe(3);
    expect(result.sections.filter(s => s.id.startsWith('custom-'))).toHaveLength(8);
    expect(new Set(result.sections.map(s => s.id)).size).toBe(result.sections.length);
    expect(result).not.toHaveProperty('css');
  });
  it.each(['javascript:alert(1)', 'data:text/html,hello', 'https://user:secret@example.com', '//example.com'])('rejects unsafe custom links: %s', url => {
    expect(safeWebsiteUrl(url)).toBe('');
  });
  it('normalizes contact emails and domains while rejecting unsafe schemes', () => {
    expect(normalizeContactUrl('breeder@example.com')).toBe('mailto:breeder@example.com');
    expect(normalizeContactUrl('example.com/contact')).toBe('https://example.com/contact');
    expect(normalizeContactUrl('javascript:alert(1)')).toBe('');
  });
  it('keeps button text readable for bright and dark custom colors', () => {
    expect(websitePalette({ accent: '#ffffff' }).buttonText).toBe('#07110a');
    expect(websitePalette({ accent: '#000000' }).buttonText).toBe('#ffffff');
    expect(websitePalette({ background: '#ffffff', mode: 'dark' }).text).toBe('#1c241f');
  });
});

describe('public website renderer', () => {
  it('renders saved section order, labels, branding, and escaped content; hides reserved links', () => {
    const website = normalizeWebsite({ announcement: 'Autumn availability', font: 'editorial', sections: [custom, { id: 'about', title: 'Our story' }] });
    const html = render({ page: { title: 'Fixture Cresties', description: '<script>bad()</script>', external_links: applyStoreSettings([{ kind: 'instagram', url: 'https://instagram.com/fixture' }], { website }) }, settings: { website } });
    expect(html.indexOf('id="website-custom-care"')).toBeLessThan(html.indexOf('id="website-about"'));
    expect(html).toContain('Our story'); expect(html).toContain('Autumn availability');
    expect(html).toContain('&lt;script&gt;bad()&lt;/script&gt;'); expect(html).not.toContain('<script>');
    expect(html).not.toContain('geck:'); expect(html).toContain('https://instagram.com/fixture');
  });
  it('respects section visibility, availability toggle, and inquiry preference', () => {
    const html = render({ page: { description: 'Bio', contact_link: 'mailto:breeder@example.com' }, profile: { accepts_inquiries: false }, onInquire: () => {},
      geckos: [{ id: 'g1', name: 'Private label fixture' }], settings: { showAvailable: false, website: { sections: [{ id: 'about', visible: false }] } } });
    expect(html).not.toContain('id="website-about"'); expect(html).not.toContain('Private label fixture'); expect(html).not.toContain('Contact breeder');
  });
  it('shows only an open, unexpired waitlist and uses the saved gallery and pairing data', () => {
    const props = { geckos: [{ id: 'g1', name: 'Lilly White', asking_price: 300 }], plans: [{ id: 'p1', sire: { name: 'Sire' }, dam: { name: 'Dam' } }], waitlist: { slug: 'autumn', title: 'Autumn hatchlings', is_open: true } };
    const html = render(props);
    expect(html).toContain('$300'); expect(html).toContain('Sire × Dam'); expect(html).toContain('href="/waitlist/autumn"');
    expect(render({ ...props, waitlist: { ...props.waitlist, closes_at: '2020-01-01' } })).not.toContain('id="website-waitlist"');
  });
});
