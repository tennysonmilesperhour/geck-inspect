/**
 * Highway: one continuous, clean cream stripe down the spine.
 * Cappuccino's dorsum already covers the back, so it wins when both are present.
 */

export default function Highway({ expressed, covered, stripeHex }) {
  if (!expressed || covered) return null;
  const spine = 'M 150,214 C 230,199 330,195 430,195 C 530,195 600,198 650,208';
  return (
    <g id="highway">
      <path d={spine} stroke={stripeHex} strokeWidth="14" fill="none" strokeLinecap="round" opacity="0.95" />
    </g>
  );
}
