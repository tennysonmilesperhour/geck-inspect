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
  return (
    <div className="w-full h-full [&_path]:transition-[fill,stroke,opacity] [&_path]:duration-200 [&_ellipse]:transition-[fill,stroke,opacity,rx,ry] [&_ellipse]:duration-200 [&_circle]:transition-[fill,stroke,opacity,r] [&_circle]:duration-200 [&_stop]:transition-[stop-color,stop-opacity] [&_stop]:duration-200">
      {view === 'top' ? (
        <GeckoCanvasTop phenotype={phenotype} selections={selections} />
      ) : (
        <GeckoCanvasSide phenotype={phenotype} selections={selections} />
      )}
    </div>
  );
}

