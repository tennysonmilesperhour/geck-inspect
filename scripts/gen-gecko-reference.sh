#!/usr/bin/env bash
# Generates a side-profile crested gecko BASE OUTLINE image via Replicate
# (Flux Dev, ~$0.025, ~10s) and saves it to ./gecko-base.png.
#
# Uses Flux Dev (one tier above Schnell) because Schnell over-simplifies
# anatomy when asked for line art and the head/feet come out misshapen.
# Dev preserves the realistic proportions while still rendering a clean
# B&W outline at this prompt.
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

PROMPT='Anatomically accurate vintage scientific illustration of a crested gecko (Correlophus ciliatus) shown in side profile, head facing right, body in a relaxed perched posture with the dorsal arch clearly visible (distinct shoulder hump and hip hump with a saddle between them), all four legs bent at the knee and elbow joints with the limbs reading as three-dimensional rather than flat, each foot showing five wide splayed lamellae toe pads in side view, tapered tail extending to the left from the hip with a clear upward curl at the very tip, head shaped as a triangular wedge that is broadest behind the supraorbital crests and tapers to a defined snout, prominent supraorbital eyelash crest ridge sitting above the large round eye, eye drawn with a clearly visible vertical slit pupil, two rows of dorsal crest spike scales running from above the eye down the neck and along the spine to the base of the tail, pronounced jowl on the lower jaw, anatomically correct crested gecko proportions throughout (this is critical), rendered as a clean black ink line drawing on pure white paper in the style of a Linnean natural history plate, every visible feature outlined in solid medium-weight black ink, body interior left pure white with no shading and no fills, white background, no colors, no gradients, no crosshatching, no patterns inside the body, no shadows, no scenery, no branch, no text, no labels, no watermark, centered composition with margin around the gecko'

echo "Calling Replicate (Flux Dev)..."
RESPONSE=$(curl -sS -X POST \
  https://api.replicate.com/v1/models/black-forest-labs/flux-dev/predictions \
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
    "go_fast": false
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
