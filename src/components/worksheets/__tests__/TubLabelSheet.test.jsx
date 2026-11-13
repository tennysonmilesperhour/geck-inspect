import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// The QR library draws the code; the test reads the address it was given.
vi.mock('qrcode.react', () => ({ QRCodeSVG: ({ value, title }) => <svg data-qr={value} data-title={title} /> }));

import TubLabelSheet, { TUB_LABEL_HEIGHT_MM, TUB_LABEL_WIDTH_MM, tubLabelUrl } from '../TubLabelSheet';
import { parseQuickLogParams, quickLogPath } from '@/lib/quickLog';

const ONYX = { id: '3f2a9c1e-7b4d-4e8a-9c61-0d5e2f7a1b34', name: 'Onyx', gecko_id_code: 'CG-014', morphs_traits: 'Lilly White Harlequin' };

describe('tub labels', () => {
  it('encodes the one-tap log address reminder links already use, for that gecko', () => {
    const url = tubLabelUrl(ONYX, 'https://geckinspect.com');
    expect(url).toBe(`https://geckinspect.com/log?type=feeding&gecko=${ONYX.id}`);
    // The same address the reminder jobs build.
    expect(url).toBe(`https://geckinspect.com${quickLogPath({ type: 'feeding', geckoIds: [ONYX.id] })}`);
    // And the log screen reads it back as this gecko, and only this gecko.
    const read = parseQuickLogParams(new URL(url).search);
    expect(read).toMatchObject({ type: 'feeding', geckoIds: [ONYX.id], groupIds: [], more: 0, from: null });
  });

  it('uses the site address when there is no page address a camera could open', () => {
    // No window here (as in the iPhone app's own address): the site stands in.
    expect(tubLabelUrl(ONYX)).toBe(`https://geckinspect.com/log?type=feeding&gecko=${ONYX.id}`);
  });

  it('gives no address for a gecko whose id cannot go in a log link', () => {
    expect(tubLabelUrl({ id: 'not a safe id!' }, 'https://geckinspect.com')).toBeNull();
    expect(tubLabelUrl({}, 'https://geckinspect.com')).toBeNull();
    expect(tubLabelUrl(null, 'https://geckinspect.com')).toBeNull();
  });

  it('prints one 62 x 29 mm label per gecko, each with its own code, name and ID', () => {
    const geckos = Array.from({ length: 12 }, (_, i) => ({ id: `g${i}`, name: `Gecko ${i}`, gecko_id_code: `CG-${i}` }));
    const html = renderToStaticMarkup(<TubLabelSheet geckos={geckos} />);
    expect(html.match(/class="tub-label"/g)).toHaveLength(12);
    expect(TUB_LABEL_WIDTH_MM).toBe(62);
    expect(TUB_LABEL_HEIGHT_MM).toBe(29);
    expect(html.match(/width:62mm;height:29mm/g)).toHaveLength(12);
    const codes = [...html.matchAll(/data-qr="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));
    expect(codes).toEqual(geckos.map((g) => `https://geckinspect.com/log?type=feeding&gecko=${g.id}`));
    expect(html).toContain('Gecko 11');
    expect(html).toContain('CG-11');
    expect(html).toContain('Scan to log');
    // Black on white, for any printer.
    expect(html).toContain('color:#000');
    expect(html).toContain('background-color:#fff');
  });

  it('still prints the name when a gecko has no usable id or ID code', () => {
    const html = renderToStaticMarkup(<TubLabelSheet geckos={[{ id: 'bad id', name: 'Sable girl' }]} />);
    expect(html).toContain('Sable girl');
    expect(html).not.toContain('data-qr');
    expect(html).toContain('No code for this gecko');
  });
});
