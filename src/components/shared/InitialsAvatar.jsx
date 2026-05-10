/**
 * InitialsAvatar ,  local SVG avatar that renders a user's initials.
 *
 * Replaces the external ui-avatars.com dependency so the app doesn't
 * depend on a third-party service for every user avatar. Works offline,
 * loads instantly, and never fires a network request.
 *
 * Usage:
 *   <InitialsAvatar name="Jane Doe" className="w-8 h-8 rounded-full" />
 *
 * Also exported as a helper that returns a data-URI string for use in
 * <img src={...}> fallbacks without changing the existing JSX pattern:
 *   src={user.profile_image_url || initialsAvatarUrl(user.full_name)}
 */

const PALETTE = [
  '#059669', '#0d9488', '#0891b2', '#2563eb', '#7c3aed',
  '#c026d3', '#e11d48', '#ea580c', '#ca8a04', '#65a30d',
];

function pickColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || '?';
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function initialsAvatarUrl(name, size = 64) {
  const initials = getInitials(name);
  const bg = pickColor(name || '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" rx="${size / 2}" fill="${bg}"/><text x="50%" y="50%" dy=".1em" fill="#fff" font-family="Inter,system-ui,sans-serif" font-size="${size * 0.4}" font-weight="600" text-anchor="middle" dominant-baseline="central">${initials}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export default function InitialsAvatar({ name, className, size = 64 }) {
  const initials = getInitials(name);
  const bg = pickColor(name || '');
  const fontSize = size * 0.4;

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={`Avatar for ${name || 'user'}`}
    >
      <rect width={size} height={size} rx={size / 2} fill={bg} />
      <text
        x="50%"
        y="50%"
        dy=".1em"
        fill="#fff"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize={fontSize}
        fontWeight="600"
        textAnchor="middle"
        dominantBaseline="central"
      >
        {initials}
      </text>
    </svg>
  );
}
