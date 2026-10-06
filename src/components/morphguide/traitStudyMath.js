// Uneven clusters of colored crest scales, shared longitudinally by both views.
const EDGES = [0,3.8,10.5,14.2,23.6,29.1,34.4,42.8,47,53.9,63.5,68.1,75.6,84.2,90.4,96,100];
const ORDER = [4,11,1,14,6,9,0,12,7,3,15,5,10,2,13,8];
export function pinSegments(value, row = 0) {
  const amount = Math.max(0,Math.min(1,Number(value)||0));
  if (amount === 0) return [];
  if (amount === 1) return [{ start:0, length:100 }];
  return EDGES.slice(0,-1).flatMap((start,i) => {
    const rank = (ORDER[i]+row*3)%16;
    const fraction = Math.max(0,Math.min(1,amount*16-rank));
    const width = EDGES[i+1]-start;
    return fraction ? [{ start:start+width*(1-fraction)/2, length:width*fraction }] : [];
  });
}
