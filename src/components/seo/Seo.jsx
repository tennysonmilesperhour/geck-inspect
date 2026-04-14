import { Helmet } from 'react-helmet-async';

/**
 * Per-page SEO component. Drop this at the top of any page to override
 * the site-level meta tags from index.html.
 *
 * Usage:
 *   <Seo
 *     title="Crested Gecko Morph Guide"
 *     description="Reference for Harlequin, Dalmatian, Pinstripe..."
 *     path="/MorphGuide"
 *     keywords={['crested gecko', 'morph guide', 'harlequin']}
 *     type="article"
 *     publishedTime="2026-01-01"
 *     modifiedTime="2026-04-11"
 *     jsonLd={...}
 *   />
 *
 * The component supports:
 *   - title / description / image / path / canonical
 *   - keywords (array or string) — rendered as <meta name="keywords">
 *   - Open Graph (og:*) + Article meta (og:type="article")
 *   - Twitter card with @geckinspect handles
 *   - Optional JSON-LD (object or array; gets wrapped in @graph if array)
 *   - noIndex flag for private/admin pages
 */
const SITE_URL = 'https://geckinspect.com';
const SITE_NAME = 'Geck Inspect';
const SITE_HANDLE = '@geckinspect';
const DEFAULT_IMAGE =
  'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68929cdad944c572926ab6cb/2ba53d481_Inspect.png';

// Default keyword base that every page picks up — keeps the top-level
// crested gecko identity searches consistent across the whole app.
const BASE_KEYWORDS = [
  'crested gecko',
  'Correlophus ciliatus',
  'crestie',
  'reptile collection tracker',
  'breeding software',
  'morph guide',
  'gecko breeding app',
];

export default function Seo({
  title,
  description,
  image = DEFAULT_IMAGE,
  imageAlt,
  path = '',
  type = 'website',
  noIndex = false,
  keywords,
  author,
  publishedTime,
  modifiedTime,
  jsonLd,
}) {
  const fullTitle = title
    ? `${title} — ${SITE_NAME}`
    : `${SITE_NAME} — Crested Gecko Collection, Breeding & Community Platform`;
  const canonical = `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;

  const mergedKeywords = Array.isArray(keywords)
    ? [...new Set([...BASE_KEYWORDS, ...keywords])].join(', ')
    : keywords || BASE_KEYWORDS.join(', ');

  // If jsonLd is an array, wrap it in an @graph container so a single
  // <script> can emit multiple schema.org objects (the "@graph" form is
  // the recommended multi-entity pattern).
  let jsonLdOutput = jsonLd;
  if (Array.isArray(jsonLd)) {
    jsonLdOutput = {
      '@context': 'https://schema.org',
      '@graph': jsonLd,
    };
  }

  return (
    <Helmet>
      <title>{fullTitle}</title>
      {description && <meta name="description" content={description} />}
      {mergedKeywords && <meta name="keywords" content={mergedKeywords} />}
      {author && <meta name="author" content={author} />}
      <link rel="canonical" href={canonical} />
      {noIndex && <meta name="robots" content="noindex, nofollow" />}
      {!noIndex && <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />}

      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={fullTitle} />
      {description && <meta property="og:description" content={description} />}
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={image} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      {imageAlt && <meta property="og:image:alt" content={imageAlt} />}
      <meta property="og:locale" content="en_US" />

      {/* Article-specific meta when type='article' */}
      {type === 'article' && publishedTime && (
        <meta property="article:published_time" content={publishedTime} />
      )}
      {type === 'article' && modifiedTime && (
        <meta property="article:modified_time" content={modifiedTime} />
      )}
      {type === 'article' && author && (
        <meta property="article:author" content={author} />
      )}

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content={SITE_HANDLE} />
      <meta name="twitter:creator" content={SITE_HANDLE} />
      <meta name="twitter:title" content={fullTitle} />
      {description && <meta name="twitter:description" content={description} />}
      <meta name="twitter:image" content={image} />
      {imageAlt && <meta name="twitter:image:alt" content={imageAlt} />}

      {/* Structured data */}
      {jsonLdOutput && (
        <script type="application/ld+json">
          {typeof jsonLdOutput === 'string' ? jsonLdOutput : JSON.stringify(jsonLdOutput)}
        </script>
      )}
    </Helmet>
  );
}
