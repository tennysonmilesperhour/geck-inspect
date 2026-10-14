import { useState } from 'react';
import { DEFAULT_GECKO_IMAGE } from '@/lib/constants';
import { geckoPlaceholderAsset, geckoPlaceholderProfile } from '@/lib/geckoPlaceholderProfiles';

function SexEmblem({ sex }) {
  if (sex === 'unsexed') return <text x="390" y="132" textAnchor="middle" fontFamily="Georgia, serif" fontSize="47" fill="currentColor">?</text>;
  return <g fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx={sex === 'male' ? 384 : 390} cy={sex === 'male' ? 123 : 111} r="13" />
    {sex === 'male'
      ? <path d="M394 113 L409 98 M396 98 H409 V111" />
      : <path d="M390 124 V143 M380 134 H400" />}
  </g>;
}

/** Generated illustration, with live record labels rendered as accessible text. */
export default function GeckoPlaceholder({ gecko, alt, width = 512, className = '', style, onLoad, onError, loading = 'lazy', decoding = 'async', artStyle, now, ...rest }) {
  const profile = geckoPlaceholderProfile(gecko, now, artStyle);
  const asset = geckoPlaceholderAsset(profile, width);
  const [failedAsset, setFailedAsset] = useState(null);
  const failed = failedAsset === asset;
  const ageLine = profile.ageGroup === 'unknown'
    ? profile.ageDetail || profile.ageLabel
    : `${profile.ageLabel}${profile.ageDetail ? ` · ${profile.ageDetail}` : ''}`;
  const label = `${alt || gecko?.name || 'Gecko'}, illustrated placeholder, ${profile.sexLabel.toLowerCase()}, ${ageLine.toLowerCase()}, ${profile.style.label}`;

  return <div
    {...rest}
    role="img"
    aria-label={label}
    className={`relative block overflow-hidden ${className}`}
    style={{ ...style, aspectRatio: '1 / 1', objectFit: 'contain', objectPosition: 'center', transform: 'none', padding: 0, backgroundColor: '#0b1a14' }}
    data-gecko-placeholder="personalized"
    data-art-style={profile.style.id}
    data-age-group={profile.ageGroup}
    data-sex={profile.sex}
  >
    <img
      src={failed ? DEFAULT_GECKO_IMAGE : asset}
      alt=""
      aria-hidden="true"
      loading={loading}
      decoding={decoding}
      className="block h-full w-full"
      style={{ objectFit: 'contain', objectPosition: 'center', transform: 'none' }}
      onLoad={onLoad}
      onError={event => { if (!failed) setFailedAsset(asset); onError?.(event); }}
    />
    {!failed && <svg viewBox="0 0 1024 1024" preserveAspectRatio="xMidYMid meet" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full">
      <g transform={profile.style.id === 'woodcut' ? 'translate(0,-22)' : undefined}>
        <circle cx="390" cy="119" r="33" fill={profile.style[profile.sex]} />
        <g color={profile.style.paper}><SexEmblem sex={profile.sex} /></g>
        <text x="550" y="133" textAnchor="middle" fill={profile.style[profile.sex]} fontFamily="Georgia, 'Times New Roman', serif" fontSize="42" fontWeight="700" letterSpacing="2">{profile.sexLabel.toUpperCase()}</text>
      </g>
      <g transform={profile.style.id === 'woodcut' ? 'translate(0,22)' : undefined}>
        <text x="512" y="894" textAnchor="middle" fill={profile.style.ink} fontFamily="Georgia, 'Times New Roman', serif" fontSize="29" fontWeight="700">{ageLine.toUpperCase()}</text>
        <text x="512" y="930" textAnchor="middle" fill={profile.style.ink} fontFamily="Arial, sans-serif" fontSize="22" fontWeight="600" letterSpacing="4">ADD PHOTO</text>
      </g>
    </svg>}
  </div>;
}
