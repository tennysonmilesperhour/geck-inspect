/**
 * Dorsum layer ,  the paler dorsal band running head-to-tail.
 * This is where pinstripe rails attach; cappuccino replaces it entirely
 * with a cream "coffee stain" sweep.
 */

import { DORSUM_PATH } from '../svgShapes';

export default function Dorsum({ palette, suppressed, expressed }) {
  // When dorsum is suppressed by Empty Back or Cappuccino, we still paint
  // a flat dorsum tone ,  just without any pattern on top of it.
  if (suppressed?.warmPigment) {
    // Axanthic ,  dorsum matches grayscale palette
    return <path d={DORSUM_PATH} fill={palette.dorsum} opacity="0.7" />;
  }

  if (expressed?.cappuccino) {
    return <path d={DORSUM_PATH} fill={palette.dorsum} opacity="0.95" />;
  }

  return <path d={DORSUM_PATH} fill={palette.dorsum} opacity="0.5" />;
}
