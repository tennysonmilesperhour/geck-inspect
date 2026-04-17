/**
 * Canvas dispatcher — routes between the side and top views of the gecko.
 * Both views consume the same phenotype + selections, so the renderer is
 * fully driven by the genetics/trait data.
 */

import GeckoCanvasSide from './GeckoCanvasSide';
import GeckoCanvasTop  from './GeckoCanvasTop';

export default function GeckoCanvas({ view = 'side', phenotype, selections }) {
  if (view === 'top') {
    return <GeckoCanvasTop phenotype={phenotype} selections={selections} />;
  }
  return <GeckoCanvasSide phenotype={phenotype} selections={selections} />;
}
