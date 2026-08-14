import type { Category } from "../game/types";

export function CategoryBadge({ cat }: { cat: Category }) {
  return <span className={`badge ${cat}`}>{cat}</span>;
}

export function RatingBadge({ ca }: { ca: number }) {
  const cls = ca >= 180 ? "r90" : ca >= 170 ? "r85" : ca >= 160 ? "r80" : "";
  return <span className={`rating ${cls}`}>{ca}</span>;
}

export function CAStar({ ca }: { ca: number }) {
  if (ca >= 170) return <span title="World class">★★★★★</span>;
  if (ca >= 160) return <span title="Excellent">★★★★☆</span>;
  if (ca >= 150) return <span title="Good">★★★☆☆</span>;
  if (ca >= 140) return <span title="Solid">★★☆☆☆</span>;
  if (ca >= 130) return <span title="Decent">★☆☆☆☆</span>;
  return <span title="Poor">☆☆☆☆☆</span>;
}

export function FormDots({ form }: { form: ("W" | "D" | "L")[] }) {
  if (!form.length) return <span className="muted">—</span>;
  return (
    <span className="form-dots">
      {form.map((r, i) => (
        <span key={i} className={`form-dot ${r}`}>{r}</span>
      ))}
    </span>
  );
}

export function RatingDots({ form }: { form: number[] }) {
  if (!form.length) return <span className="muted">—</span>;
  return (
    <span className="form-dots">
      {form.map((r, i) => (
        <span key={i} className={`form-dot ${r >= 7.5 ? "W" : r >= 6.5 ? "D" : "L"}`}>{Math.round(r)}</span>
      ))}
    </span>
  );
}
