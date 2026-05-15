#!/usr/bin/env bash
# Generates a side-profile crested gecko reference image via Replicate
# (Flux Schnell, ~$0.003, ~3s) and saves it to ./gecko-reference.png.
#
# Usage:
#   REPLICATE_API_TOKEN=r8_xxx ./scripts/gen-gecko-reference.sh
#
# Sends the image to ./gecko-reference.png in the cwd. The Morph
# Visualizer SVG paths in src/components/morph-visualizer/render/svgShapes.js
# are then traced against that reference.
#
# This script is intentionally one-off. Delete it after the reference is
# captured. The Replicate token never gets written to a file.

set -euo pipefail

if [ -z "${REPLICATE_API_TOKEN:-}" ]; then
  echo "REPLICATE_API_TOKEN not set. Run as:"
  echo "  REPLICATE_API_TOKEN=r8_xxx ./scripts/gen-gecko-reference.sh"
  exit 1
fi

PROMPT='Side profile illustration of a crested gecko (Correlophus ciliatus) on a horizontal branch, head facing right, full body visible from nose to tail tip, clean off-white background, simple vector illustration with bold dark outline and flat colors, anatomically accurate proportions, prominent supraorbital eyelash crest ridge above the large round eye, two rows of dorsal crest spike scales running from above the eye down the neck and along the back to the base of the tail, four bent legs with visible knee joints, each foot showing five wide splayed lamellae toe pads gripping the branch, tapered tail curling slightly downward, vertical slit pupil, no shadows, no background scenery, no text, no labels, no watermark, centered composition with margin around the gecko'

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
curl -sS "$URL" -o gecko-reference.png

echo "Saved: $(pwd)/gecko-reference.png"
echo "Send this image back in your next message to Claude."
