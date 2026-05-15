#!/usr/bin/env bash
# Generates a side-profile crested gecko BASE OUTLINE image via Replicate
# (Flux Schnell, ~$0.003, ~3s) and saves it to ./gecko-base.png.
#
# This image is the BASE LAYER for the Morph Visualizer. Trait colors and
# pattern overlays render BEHIND it (clipped to the gecko's shape), and
# the outline composites ON TOP via multiply blend so the line work stays
# crisp regardless of which colors are chosen. The prompt asks for a pure
# white body fill with solid black outlines so:
#   - Color/pattern fills behind the image show cleanly through the white
#     interior when the outline is drawn on top with mix-blend-mode multiply
#   - The black outline (silhouette, crests, eye, mouth, legs, toes) stays
#     dark against any color choice
#
# Usage:
#   REPLICATE_API_TOKEN=r8_xxx ./scripts/gen-gecko-reference.sh
#
# Saves to ./gecko-base.png in the cwd. Send the image back to Claude in
# the next message; it gets committed to public/morph-visualizer/gecko-base.png
# and the canvas wires it up in the same commit.
#
# The Replicate token is read from the environment and never written to disk.

set -euo pipefail

if [ -z "${REPLICATE_API_TOKEN:-}" ]; then
  echo "REPLICATE_API_TOKEN not set. Run as:"
  echo "  REPLICATE_API_TOKEN=r8_xxx ./scripts/gen-gecko-reference.sh"
  exit 1
fi

PROMPT='Side profile line drawing of a crested gecko (Correlophus ciliatus), head facing right, full body visible from nose to curled tail tip, in a relaxed perched posture with all four legs visible and bent at the knee and elbow joints, each foot showing splayed toe pads with visible lamellae, tail extending to the left with a slight upward curl at the tip, large round eye with vertical slit pupil, prominent supraorbital eyelash crest ridge above the eye, two rows of dorsal crest spike scales running from above the eye down the neck and along the spine to the base of the tail, anatomically accurate crested gecko proportions, pure white body interior fill (no color, no shading, no texture, no gradient), bold solid black outline of uniform medium line weight for the silhouette and every internal feature (crests, eye, nostril, mouth, toes, leg edges), pure white background, flat 2D vector coloring book illustration style, technical illustration aesthetic, no shadows, no scenery, no branch, no text, no labels, no watermark, centered composition with generous margin around the gecko, gecko fills about 80 percent of the frame width'

echo "Calling Replicate (Flux Schnell)..."
RESPONSE=$(curl -sS -X POST \
  https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions \
  -H "Authorization: Token $REPLICATE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Prefer: wait" \
  -d "$(cat <<EOF
{
  "input": {
    "prompt": $(printf '%s' "$PROMPT" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read()))"),
    "aspect_ratio": "16:9",
    "output_format": "png",
    "num_outputs": 1,
    "go_fast": true
  }
}
EOF
)")

# Pull the first output URL out of the JSON. Replicate returns either
# {"output": ["url"]} or sometimes {"output": "url"} depending on the model.
URL=$(printf '%s' "$RESPONSE" | python3 -c "
import sys, json
data = json.loads(sys.stdin.read())
out = data.get('output')
if isinstance(out, list):
    print(out[0])
elif isinstance(out, str):
    print(out)
else:
    print('ERROR: no output', file=sys.stderr)
    print(json.dumps(data, indent=2), file=sys.stderr)
    sys.exit(1)
")

echo "Downloading $URL ..."
curl -sS "$URL" -o gecko-base.png

echo "Saved: $(pwd)/gecko-base.png"
echo "Send this image back in your next message to Claude."
