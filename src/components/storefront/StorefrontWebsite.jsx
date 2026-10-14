import { Link } from 'react-router-dom';
import GeckoImage from '@/components/shared/GeckoImage';
import { DEFAULT_GECKO_IMAGE } from '@/lib/constants';
import { linkKindMeta } from '@/lib/storeLinks';
import { normalizeWebsite, WEBSITE_FONTS, websitePalette, safeWebsiteUrl } from '@/lib/storeWebsite';
import { publicExternalLinks, themeFor, geckoDetailHref } from './StorefrontSections';
import './storefrontWebsite.css';

export default function StorefrontWebsite({ page = {}, profile = {}, settings = {}, geckos = [], plans = [], waitlist,
  reviews, trust, onInquire, onOpenGecko, preview = false, onSectionSelect }) {
  const w = normalizeWebsite(settings.website);
  const palette = websitePalette(w, themeFor(settings.theme).swatchHex);
  const title = page.title || profile.display_name || 'Your breeding business';
  const bio = page.description || profile.bio;
  const policy = page.policies;
  const contact = profile.accepts_inquiries === false ? '' : safeWebsiteUrl(page.contact_link, true);
  const links = publicExternalLinks(page.external_links).filter(l => safeWebsiteUrl(l.url, true));
  const logo = w.logoUrl || safeWebsiteUrl(profile.profile_photo || profile.profile_image_url);
  const banner = safeWebsiteUrl(page.header_image_url || profile.banner_photo);
  const canInquire = profile.accepts_inquiries !== false && Boolean(onInquire);
  const available = settings.showAvailable !== false && geckos.length > 0;
  const hasContent = section => section.id.startsWith('custom-') ? Boolean(section.body || section.imageUrl) : ({
    about: Boolean(bio), available, pairings: plans.length > 0,
    waitlist: Boolean(waitlist?.is_open && (!waitlist.closes_at || new Date(waitlist.closes_at) > new Date())),
    policies: Boolean(policy), reviews: Boolean(reviews), contact: Boolean(contact || links.length || canInquire),
  })[section.id];
  const sections = w.sections.filter(s => s.visible && hasContent(s));
  const primary = canInquire
    ? <button className="sw-button" type="button" onClick={() => onInquire(null)}>{w.buttonLabel}</button>
    : contact ? <a className="sw-button" href={contact} target="_blank" rel="noopener noreferrer">{w.buttonLabel}</a> : null;
  return (
    <div className={`store-website sw-${w.heroLayout}`} data-preview={preview || undefined} style={{
      '--sw-bg': palette.background, '--sw-text': palette.text, '--sw-muted': palette.muted,
      '--sw-panel': palette.panel, '--sw-border': palette.border, '--sw-accent': palette.accent,
      '--sw-button-text': palette.buttonText, '--sw-font': WEBSITE_FONTS[w.font],
      '--sw-radius': `${w.radius}px`, '--sw-space': `${w.spacing}px`, '--sw-width': `${w.width}px`,
      '--sw-height': `${w.heroHeight}px`, '--sw-columns': Math.round(w.columns),
    }}>
      {w.announcement && <div className="sw-announcement">{w.announcement}</div>}
      <header className={`sw-hero ${banner ? 'sw-has-image' : ''}`}>
        {banner && <img className="sw-hero-image" src={banner} alt="" style={{ objectPosition: `center ${w.imagePosition}%` }} />}
        {banner && w.heroLayout !== 'split' && <div className="sw-overlay" style={{ background: `rgba(0,0,0,${w.overlay / 100})` }} />}
        <div className="sw-hero-inner">
          {logo && <img src={logo} className="sw-logo" alt={`${title} logo`} />}
          <p className="sw-eyebrow">{profile.location || 'Crested geckos, raised with care'}</p>
          <h1>{title}</h1>
          {page.tagline && <p className="sw-tagline">{page.tagline}</p>}
          {profile.years_breeding > 0 && <p className="sw-verified">{profile.years_breeding} {profile.years_breeding === 1 ? 'year' : 'years'} breeding</p>}
          {profile.is_verified && <p className="sw-verified">✓ Verified breeder</p>}
          {primary && <div className="sw-hero-action">{primary}</div>}
        </div>
      </header>
      {sections.length > 0 && <nav className="sw-nav" aria-label="Website sections"><div className="sw-container">
        {sections.map(s => <a key={s.id} href={`#website-${s.id}`} onClick={() => onSectionSelect?.(s.id)}>{s.title}</a>)}
      </div></nav>}
      <main className="sw-container sw-main">
        {sections.map(section => <section key={section.id} id={`website-${section.id}`} className={`sw-section sw-section-${section.id}`}>
          <h2>{section.title}</h2>
          {section.id === 'about' && <><p className="sw-prose sw-intro">{bio}</p>
            {profile.specialty_morphs?.length > 0 && <div className="sw-tags">{profile.specialty_morphs.map(m => <span key={m}>{m}</span>)}</div>}
            {trust && <div className="sw-trust">{trust}</div>}</>}
          {section.id === 'available' && <div className="sw-grid">
            {geckos.map(gecko => <article className="sw-card" key={gecko.id}>
              {onOpenGecko ? <button type="button" className="sw-photo" onClick={() => onOpenGecko(gecko)} aria-label={`View ${gecko.name || 'gecko'}`}>
                <GeckoImage gecko={gecko} src={gecko.image_urls?.[0] || DEFAULT_GECKO_IMAGE} alt={gecko.name || 'Crested gecko'} loading="lazy" />
              </button> : <Link className="sw-photo" to={geckoDetailHref(gecko)}><GeckoImage gecko={gecko} src={gecko.image_urls?.[0] || DEFAULT_GECKO_IMAGE} alt={gecko.name || 'Crested gecko'} loading="lazy" /></Link>}
              <div className="sw-card-content"><h3>{gecko.name || 'Crested gecko'}</h3>
                <p>{gecko.morphs_traits || 'Crested gecko'}</p>
                <div className="sw-card-meta"><span>{String(gecko.status || 'Showcase').replace(/_/g, ' ')}</span>
                  {gecko.asking_price != null && <strong>${Number(gecko.asking_price).toLocaleString()}</strong>}</div>
                {canInquire && <button type="button" className="sw-text-button" onClick={() => onInquire(gecko)}>Inquire about this gecko ↗</button>}
              </div>
            </article>)}
          </div>}
          {section.id === 'pairings' && <div className="sw-pairings">{plans.map(plan => <article key={plan.id} className="sw-card sw-pairing">
            <h3>{[plan.sire?.name, plan.dam?.name].filter(Boolean).join(' × ') || 'Planned pairing'}</h3>
            <div className="sw-parents">{[plan.sire, plan.dam].map((parent, i) => <div key={i}>
              <GeckoImage gecko={parent} src={parent?.image_urls?.[0] || DEFAULT_GECKO_IMAGE} alt={parent?.name || (i ? 'Dam' : 'Sire')} loading="lazy" />
              <p>{i ? 'Dam' : 'Sire'}: {parent?.name || 'Unknown'}</p>
            </div>)}</div>{plan.notes && <p className="sw-prose">{plan.notes}</p>}
          </article>)}</div>}
          {section.id === 'waitlist' && <div className="sw-callout"><div><h3>{waitlist.title || 'Be first to know'}</h3>
            {waitlist.description && <p>{waitlist.description}</p>}</div>
            <Link className="sw-button" to={`/waitlist/${encodeURIComponent(waitlist.slug)}`}>Join the waitlist</Link></div>}
          {section.id === 'policies' && <p className="sw-prose">{policy}</p>}
          {section.id === 'reviews' && <div className="sw-reviews">{reviews}</div>}
          {section.id === 'contact' && <div className="sw-contact">{primary}
            {links.map((l, i) => <a key={i} className="sw-link" href={l.url} target="_blank" rel="noopener noreferrer">{l.label || linkKindMeta(l.kind).label} ↗</a>)}
          </div>}
          {section.id.startsWith('custom-') && <div className={`sw-custom ${section.imageUrl ? 'sw-custom-with-image' : ''}`}>
            {section.imageUrl && <img src={section.imageUrl} alt={section.title} loading="lazy" />}
            {section.body && <p className="sw-prose">{section.body}</p>}
          </div>}
        </section>)}
      </main>
      <footer className="sw-footer"><span>{title}</span><Link to="/">Built on Geck Inspect ↗</Link></footer>
    </div>
  );
}
