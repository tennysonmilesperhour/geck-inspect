// Direct / local sponsor card.
// Styled to feel like part of the app — not a banner ad.

export default function SponsorCard({ sponsor, label = 'Sponsored' }) {
  const tagline = sponsor.tagline ? sponsor.tagline.slice(0, 80) : ''

  return (
    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        padding: '10px 12px',
        background: '#f9fafb',
      }}
    >
      {/* Label */}
      <p
        style={{
          fontSize: 10,
          color: '#9ca3af',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: 6,
        }}
      >
        {label}
      </p>

      {/* Logo */}
      {sponsor.imageUrl && (
        <img
          src={sponsor.imageUrl}
          alt={sponsor.name}
          style={{ height: 32, marginBottom: 6, objectFit: 'contain', display: 'block' }}
        />
      )}

      {/* Name */}
      <p style={{ fontSize: 13, fontWeight: 600, color: '#1f2937', marginBottom: 2, lineHeight: 1.3 }}>
        {sponsor.name}
      </p>

      {/* Tagline */}
      {tagline && (
        <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 8, lineHeight: 1.4 }}>
          {tagline}
        </p>
      )}

      {/* CTA */}
      <a
        href={sponsor.url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-block',
          fontSize: 12,
          padding: '3px 10px',
          background: '#fff',
          border: '1px solid #d1d5db',
          borderRadius: 5,
          color: '#374151',
          textDecoration: 'none',
          fontWeight: 500,
        }}
      >
        Visit →
      </a>
    </div>
  )
}
