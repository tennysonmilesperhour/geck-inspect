/**
 * Renders the photo-realistic preset image for a morph from
 * public/morph-presets/<id>.webp. Falls back to the legacy SVG visualizer
 * if the image is missing or hasn't been generated yet, so the page works
 * in both states during the rollout.
 */

import { useState } from 'react';
import GeckoCanvas from '../render/GeckoCanvas';

export default function PresetImage({ preset, phenotype, selections, view = 'side' }) {
  const [errored, setErrored] = useState(false);

  const src = `/morph-presets/${preset.id}.webp`;

  if (errored) {
    return (
      <div className="w-full h-full">
        <GeckoCanvas view={view} phenotype={phenotype} selections={selections} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`${preset.name} crested gecko ,  ${preset.description}`}
      onError={() => setErrored(true)}
      className="w-full h-full object-cover"
      loading="lazy"
    />
  );
}
