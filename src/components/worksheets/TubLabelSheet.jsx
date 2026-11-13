import { QRCodeSVG } from 'qrcode.react';
import { quickLogPath } from '@/lib/quickLog';

// Tub labels that open the log (experience review, section 8 item 8): a
// sheet of small labels, one per gecko, each with the name, the ID code
// and a QR code. Scanning the code with the phone camera opens that
// gecko's one-tap log (after sign-in), so a feeding is logged standing at
// the tub. The address is the one reminder links already use
// (/log?type=feeding&gecko=<id>, src/lib/quickLog.js); nothing new.
//
// Each label is 62 x 29 mm, the common address-label size, black on
// white. The grid fills the page with as many columns as fit, so it
// prints cleanly on A4 and on US Letter at the page's 0.5 inch margins.

export const TUB_LABEL_WIDTH_MM = 62;
export const TUB_LABEL_HEIGHT_MM = 29;

/**
 * The address a gecko's tub label encodes, or null for a gecko whose id
 * cannot go in a log link. The site address is used inside the iPhone and
 * Android apps, whose own address no camera can open.
 */
export function tubLabelUrl(gecko, origin) {
  const id = gecko?.id == null ? '' : String(gecko.id);
  if (!id) return null;
  const path = quickLogPath({ type: 'feeding', geckoIds: [id] });
  // quickLogPath leaves out an id that does not pass the link rule.
  if (!path.includes('gecko=')) return null;
  const native = typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.();
  const base = origin || (!native && typeof window !== 'undefined' ? window.location.origin : 'https://geckinspect.com');
  return `${base}${path}`;
}

const ONE_LINE = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };

function TubLabel({ gecko }) {
  const url = tubLabelUrl(gecko);
  return (
    <div
      className="tub-label"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '2mm',
        width: `${TUB_LABEL_WIDTH_MM}mm`,
        height: `${TUB_LABEL_HEIGHT_MM}mm`,
        border: '1px solid #000',
        borderRadius: '1mm',
        padding: '2mm',
        boxSizing: 'border-box',
        overflow: 'hidden',
        breakInside: 'avoid',
        pageBreakInside: 'avoid',
        color: '#000',
        backgroundColor: '#fff',
      }}
    >
      <div style={{ flex: 1, minWidth: 0, lineHeight: 1.25 }}>
        <div style={{ fontSize: '11pt', fontWeight: 700, ...ONE_LINE }}>{gecko.name || 'Unnamed gecko'}</div>
        {gecko.gecko_id_code && (
          <div style={{ fontSize: '8pt', fontFamily: 'monospace', ...ONE_LINE }}>{gecko.gecko_id_code}</div>
        )}
        <div style={{ fontSize: '7pt', marginTop: '1mm', ...ONE_LINE }}>{url ? 'Scan to log' : 'No code for this gecko'}</div>
      </div>
      {url && (
        <div style={{ flexShrink: 0, lineHeight: 0 }}>
          <QRCodeSVG
            value={url}
            size={96}
            level="M"
            fgColor="#000000"
            bgColor="#ffffff"
            style={{ width: '23mm', height: '23mm' }}
            title={`Log for ${gecko.name || 'this gecko'}`}
          />
        </div>
      )}
    </div>
  );
}

export default function TubLabelSheet({ geckos }) {
  return (
    <div style={{ color: '#000', backgroundColor: '#fff', padding: '2mm 0' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fill, ${TUB_LABEL_WIDTH_MM}mm)`,
          justifyContent: 'center',
          gap: '1.5mm',
        }}
      >
        {geckos.map((g) => <TubLabel key={g.id} gecko={g} />)}
      </div>
    </div>
  );
}
