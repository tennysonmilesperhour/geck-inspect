import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import RackLabelSheet, { labelHatchDate, passportUrlFor } from '../RackLabelSheet';

describe('rack label sheet', () => {
  it('formats hatch dates and passport links', () => {
    expect(labelHatchDate('2025-06-14')).toBe('Jun 14, 2025');
    expect(labelHatchDate('not a date')).toBeNull();
    expect(passportUrlFor({ passport_code: 'ABC123' }, 'https://geckinspect.com')).toBe('https://geckinspect.com/passport/ABC123');
    expect(passportUrlFor({}, 'https://geckinspect.com')).toBeNull();
  });

  it('prints one label per gecko with a QR only when a passport exists', () => {
    const geckos = Array.from({ length: 20 }, (_, i) => ({
      id: `g${i}`,
      name: `Gecko ${i}`,
      gecko_id_code: `CG-${i}`,
      morphs_traits: 'Lilly White Harlequin',
      sex: i % 2 ? 'Female' : 'Male',
      hatch_date: '2025-06-14',
      passport_code: i < 5 ? `P${i}` : null,
    }));
    const html = renderToStaticMarkup(<RackLabelSheet geckos={geckos} />);
    expect(html.match(/class="rack-label"/g)).toHaveLength(20);
    expect(html.match(/<svg/g)).toHaveLength(5);
    expect(html).toContain('CG-19');
    expect(html).toContain('Hatched Jun 14, 2025');
  });
});
