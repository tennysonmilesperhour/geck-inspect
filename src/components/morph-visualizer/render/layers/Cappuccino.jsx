/**
 * Cappuccino — connected, cream "coffee-stain" dorsum.
 * In visual form the dorsum is continuous but with natural irregular edges.
 * In Super (Frappuccino) the dorsum is fully patternless and expansive.
 */


export default function Cappuccino({ expressed, isSuper, palette }) {
  if (!expressed) return null;

  // For visual Cappuccino, paint a slightly irregular coffee-stain shape.
  // For Frappuccino, extend coverage dramatically down the flanks.
  const stainPath = isSuper
    ? `M 80,200 C 160,180 260,170 360,170 C 480,170 580,180 680,190
       C 710,195 725,210 715,230 C 705,245 680,255 640,258
       L 440,270 C 340,275 230,278 160,275 C 120,272 80,265 78,248 Z`
    : `M 100,200 C 180,184 280,176 380,176 C 480,176 560,184 640,192
       C 670,196 695,208 690,225 C 685,240 660,248 625,248
       L 440,254 C 360,256 270,256 200,250 C 150,245 100,238 100,220 Z`;

  return (
    <g id="cappuccino" opacity="0.98">
      <path d={stainPath} fill={palette.dorsum} />
      {/* softened natural edge — faint outer glow */}
      <path d={stainPath} fill="none" stroke={palette.highlight} strokeWidth="3" opacity="0.4" />
    </g>
  );
}
