import { format, parseISO, isValid } from 'date-fns';
import { QRCodeSVG } from 'qrcode.react';

// Printable rack label sheet (audit step 31): many geckos on one page, so a
// breeder can label a whole rack from one screen. Each label carries the
// name, ID code, morph, sex and hatch date, plus a QR code to the public
// passport when the gecko has one. Two columns of labels about 1 inch tall
// fit 20 on a US Letter or A4 page.

export function labelHatchDate(value) {
  if (!value) return null;
  const d = parseISO(String(value));
  return isValid(d) ? format(d, 'MMM d, yyyy') : null;
}

export function passportUrlFor(gecko, origin = typeof window !== 'undefined' ? window.location.origin : '') {
  return gecko?.passport_code ? `${origin}/passport/${gecko.passport_code}` : null;
}

function sexShort(sex) {
  if (!sex) return null;
  const s = String(sex).toLowerCase();
  if (s.startsWith('m')) return 'Male';
  if (s.startsWith('f')) return 'Female';
  return 'Unsexed';
}

function RackLabel({ gecko }) {
  const passportUrl = passportUrlFor(gecko);
  const hatched = labelHatchDate(gecko.hatch_date);
  const sex = sexShort(gecko.sex);
  return (
    <div
      className="rack-label"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        border: '1px solid #000',
        borderRadius: 4,
        padding: '6px 8px',
        height: '0.88in',
        boxSizing: 'border-box',
        overflow: 'hidden',
        breakInside: 'avoid',
        pageBreakInside: 'avoid',
        color: '#000',
        backgroundColor: '#fff',
      }}
    >
      <div style={{ flex: 1, minWidth: 0, lineHeight: 1.2 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {gecko.name || 'Unnamed gecko'}
          </span>
          {gecko.gecko_id_code && (
            <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#333', whiteSpace: 'nowrap' }}>
              {gecko.gecko_id_code}
            </span>
          )}
        </div>
        <div style={{ fontSize: 10, color: '#222', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {gecko.morphs_traits || 'Morph not recorded'}
        </div>
        <div style={{ fontSize: 10, color: '#444', marginTop: 2 }}>
          {[sex, hatched ? `Hatched ${hatched}` : null].filter(Boolean).join(' · ') || ' '}
        </div>
      </div>
      {passportUrl && (
        <div style={{ flexShrink: 0 }}>
          <QRCodeSVG value={passportUrl} size={62} level="M" />
        </div>
      )}
    </div>
  );
}

export default function RackLabelSheet({ geckos }) {
  return (
    <div style={{ color: '#000', backgroundColor: '#fff', padding: 16 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: '0.06in',
        }}
      >
        {geckos.map((g) => <RackLabel key={g.id} gecko={g} />)}
      </div>
    </div>
  );
}
