import React from 'react';
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
 *   />
 */
const SITE_URL = 'https://geckinspect.com';
const SITE_NAME = 'Geck Inspect';
const DEFAULT_IMAGE =
  'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68929cdad944c572926ab6cb/2ba53d481_Inspect.png';

export default function Seo({
  title,
  description,
  image = DEFAULT_IMAGE,
  path = '',
  type = 'website',
  noIndex = false,
  jsonLd,
}) {
  const fullTitle = title
    ? `${title} — ${SITE_NAME}`
    : `${SITE_NAME} — Crested Gecko Collection, Breeding & Community Platform`;
  const canonical = `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      {description && <meta name="description" content={description} />}
      <link rel="canonical" href={canonical} />
      {noIndex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={fullTitle} />
      {description && <meta property="og:description" content={description} />}
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={image} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      {description && <meta name="twitter:description" content={description} />}
      <meta name="twitter:image" content={image} />

      {/* Optional structured data */}
      {jsonLd && (
        <script type="application/ld+json">
          {typeof jsonLd === 'string' ? jsonLd : JSON.stringify(jsonLd)}
        </script>
      )}
    </Helmet>
  );
}
