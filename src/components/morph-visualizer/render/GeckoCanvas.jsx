/**
 * GeckoCanvas ,  the single SVG that composes every visual layer in order.
 *
 * Draw order (back → front):
 *   1. Branch (perch) ,  context, rendered first
 *   2. Silhouette fill (base body with gradient)
 *   3. Dorsum band (paler dorsal tone)
 *   4. Belly band (lighter underside, white wall)
 *   5. Pattern layers ,  pinstripe, flame, tiger/brindle, harlequin
 *   6. Dalmatian spots
 *   7. Lilly White splashes (goes OVER other pattern)
 *   8. Cappuccino dorsum replacement (overrides dorsal pattern)
 *   9. Scale texture
 *  10. Accents (portholes, kneecaps, drippy)
 *  11. Crests + eye + nostril + mouth
 *  12. Fire-state overlay
 */

import { VIEWBOX, BRANCH_PATH, BODY_PATH, HEAD_PATH, BODY_CLIP_ID } from './svgShapes';
import BaseBody from './layers/BaseBody';
import Dorsum from './layers/Dorsum';
import Belly from './layers/Belly';
import Pinstripe from './layers/Pinstripe';
import Flame from './layers/Flame';
import Tiger from './layers/Tiger';
import Harlequin from './layers/Harlequin';
import Dalmatian from './layers/Dalmatian';
import LillyWhite from './layers/LillyWhite';
import Cappuccino from './layers/Cappuccino';
import WhiteWall from './layers/WhiteWall';
import Accents from './layers/Accents';
import Crests from './layers/Crests';
import Eye from './layers/Eye';
import ScaleTexture from './layers/ScaleTexture';
import FireState from './layers/FireState';
import { ZYGOSITY as Z } from '../data/traits';

export default function GeckoCanvas({ phenotype, selections }) {
  const {
    palette,
    structural,
    accents,
    patternIntensity,
    expressed,
    suppressed,
    fireFactor,
  } = phenotype;

  const mend = selections.mendelian || {};
  const lwSuper     = mend.lilly_white === Z.SUPER;
  const cappSuper   = mend.cappuccino  === Z.SUPER;
  const softScale   = expressed.soft_scale;

  return (
    <svg
      viewBox={VIEWBOX}
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
      role="img"
      aria-label="Crested gecko morph preview"
    >
      {/* Backdrop ,  soft forest-floor gradient */}
      <defs>
        <radialGradient id="bg-grad" cx="50%" cy="60%" r="70%">
          <stop offset="0%"   stopColor="#1e2e1e" />
          <stop offset="100%" stopColor="#0d170d" />
        </radialGradient>
        <linearGradient id="branch-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4a3a24" />
          <stop offset="100%" stopColor="#281c10" />
        </linearGradient>
        {/* Master silhouette clip ,  every pattern overlay can use this */}
        <clipPath id={BODY_CLIP_ID}>
          <path d={BODY_PATH} />
          <path d={HEAD_PATH} />
        </clipPath>
      </defs>
      <rect width="800" height="480" fill="url(#bg-grad)" />

      {/* Perch branch */}
      <path d={BRANCH_PATH} fill="url(#branch-grad)" />
      {/* Branch bark texture */}
      {Array.from({ length: 26 }).map((_, i) => (
        <path
          key={i}
          d={`M ${20 + i * 30},${405 + (i % 3) * 3} Q ${32 + i * 30},${410} ${44 + i * 30},${405 + (i % 3) * 3}`}
          stroke="#1c1206"
          strokeWidth="1"
          fill="none"
          opacity="0.4"
        />
      ))}

      {/* Subtle ground shadow under the gecko */}
      <ellipse cx="400" cy="408" rx="360" ry="22" fill="#000" opacity="0.3" />

      {/* --- gecko stack --- */}
      <BaseBody palette={palette} structural={structural} />

      {/* Region overlays all clipped to the body silhouette */}
      <g clipPath={`url(#${BODY_CLIP_ID})`}>
        <Dorsum palette={palette} suppressed={suppressed} expressed={expressed} />
        <Belly  palette={palette} expressed={expressed} accents={accents} />
      </g>

      {/* Patterns (polygenic) ,  suppressed by cappuccino or empty back */}
      {!suppressed.dorsal && (
        <Pinstripe intensity={patternIntensity.pinstripe} palette={palette} suppressed={suppressed} />
      )}
      <Flame     intensity={patternIntensity.flame}     palette={palette} />
      <Tiger     intensity={patternIntensity.tiger}     brindleIntensity={patternIntensity.brindle} palette={palette} />
      <Harlequin intensity={patternIntensity.harlequin} palette={palette} suppressed={suppressed} />
      <Dalmatian intensity={patternIntensity.dalmatian} suppressed={suppressed} />

      {/* White Wall above belly but below pattern-lock morphs */}
      <WhiteWall expressed={expressed.white_wall} isSuper={false} />

      {/* Cappuccino repaints the dorsum ,  draw after pattern to override. */}
      <Cappuccino expressed={expressed.cappuccino} isSuper={cappSuper} palette={palette} />

      {/* Lilly White splashes sit on top of everything except details. */}
      <LillyWhite expressed={expressed.lilly_white} isSuper={lwSuper} />

      {/* Scale stippling ,  soft scale makes this near-invisible */}
      <ScaleTexture softScale={softScale} palette={palette} />

      {/* Accents ,  portholes, kneecaps, drippy dorsal */}
      <Accents accents={accents} palette={palette} />

      {/* Crests, eye, mouth */}
      <Crests palette={palette} structural={structural} suppressed={suppressed} />
      <Eye    palette={palette} suppressed={suppressed} />

      {/* Fire-state wash */}
      <FireState fireFactor={fireFactor} />
    </svg>
  );
}
