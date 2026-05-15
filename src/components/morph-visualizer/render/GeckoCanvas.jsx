/**
 * GeckoCanvas, the entry point for the Morph Visualizer preview.
 *
 * Dispatches between side-profile (default) and top-down views based on the
 * `view` prop passed by the MorphVisualizer page. Each view owns its own SVG
 * with the same 800 by 480 viewBox so the surrounding layout never shifts
 * when the user toggles.
 */

import GeckoCanvasSide from './GeckoCanvasSide';
import GeckoCanvasTop from './GeckoCanvasTop';

export default function GeckoCanvas({ phenotype, selections, view = 'side' }) {
  if (view === 'top') {
    return <GeckoCanvasTop phenotype={phenotype} selections={selections} />;
  }
  return <GeckoCanvasSide phenotype={phenotype} selections={selections} />;
}
