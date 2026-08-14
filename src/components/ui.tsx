import type { Category } from "../game/types";

export function CategoryBadge({ cat }: { cat: Category }) {
  return <span className={`badge ${cat}`}>{cat}</span>;
}

export function RatingBadge({ ca }: { ca: number }) {
  const cls = ca >= 90 ? "r90" : ca >= 85 ? "r85" : ca >= 80 ? "r80" : "";
  return <span className={`rating ${cls}`}>{ca}</span>;
}

export function CAStar({ ca }: { ca: number }) {
  if (ca >= 85) return <span title="World class">★★★★★</span>;
  if (ca >= 80) return <span title="Excellent">★★★★☆</span>;
  if (ca >= 75) return <span title="Good">★★★☆☆</span>;
  if (ca >= 70) return <span title="Solid">★★☆☆☆</span>;
  if (ca >= 65) return <span title="Decent">★☆☆☆☆</span>;
  return <span title="Poor">☆☆☆☆☆</span>;
}
