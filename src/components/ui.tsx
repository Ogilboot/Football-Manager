import type { Category } from "../game/types";
import type { SortState } from "../hooks/useSort";

export function SortHeader({ label, sortKey, sort, onSort, num }: {
  label: string;
  sortKey: string;
  sort: SortState;
  onSort: (key: string) => void;
  num?: boolean;
}) {
  const active = sort.key === sortKey;
  return (
    <th className={`${num ? "num" : ""} sortable`} onClick={() => onSort(sortKey)}>
      {label}
      {active && <span className="sort-arrow">{sort.dir === "asc" ? "▲" : "▼"}</span>}
    </th>
  );
}

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

function starValue(ability: number): number {
  return Math.max(0.5, Math.min(5, Math.round(ability / 20) / 2));
}

export function AbilityStars({ ca, pa }: { ca: number; pa: number }) {
  const gold = starValue(ca);
  const pot = starValue(pa);
  const slots = [];
  for (let i = 1; i <= 5; i++) {
    const goldHere = Math.min(1, Math.max(0, gold - (i - 1)));
    const potHere = Math.min(1, Math.max(0, pot - (i - 1)));
    let cls = "dim";
    let ch = "☆";
    if (goldHere >= 1) { cls = "gold"; ch = "★"; }
    else if (goldHere > 0) { cls = "half"; ch = "★"; }
    else if (potHere >= 1) { cls = "pot"; ch = "★"; }
    else if (potHere > 0) { cls = "pothalf"; ch = "★"; }
    slots.push(<span key={i} className={`star ${cls}`}>{ch}</span>);
  }
  return <span className="ability-stars" title={`Current ability ${ca} · Potential ${pa}`}>{slots}</span>;
}
