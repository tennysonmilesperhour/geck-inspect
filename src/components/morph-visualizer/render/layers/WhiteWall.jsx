/**
 * White Wall ,  a clean white band along the lateral body wall.
 */

export default function WhiteWall({ expressed, isSuper }) {
  if (!expressed) return null;

  const bandPath = isSuper
    ? `M 85,275 C 180,295 300,310 420,314 C 540,312 640,300 705,285
       L 710,300 C 640,322 520,335 410,335 C 290,335 180,325 90,305 Z`
    : `M 95,280 C 180,295 300,308 420,310 C 540,308 640,297 695,285
       L 700,298 C 640,316 520,325 410,326 C 290,326 180,318 100,302 Z`;

  return <path d={bandPath} fill="#f4efe1" opacity={isSuper ? 0.92 : 0.85} />;
}
