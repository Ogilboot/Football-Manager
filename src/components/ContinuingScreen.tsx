import { useEffect, useState } from "react";
import type { ContinueResult } from "../game/career";
import { addDays, formatDate } from "../game/format";
import { newsKindLabel } from "../game/news";

export function ContinuingScreen({ result, onDone }: { result: ContinueResult; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const total = result.days;

  useEffect(() => {
    if (step >= total) {
      const t = setTimeout(onDone, 250);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStep((s) => s + 1), 420);
    return () => clearTimeout(t);
  }, [step, total, onDone]);

  const currentDate = addDays(result.startDate, Math.min(step, total));
  const shown = result.news.filter((n) => n.date <= currentDate);
  const pct = total > 0 ? Math.round((step / total) * 100) : 100;

  return (
    <div className="continuing-backdrop" onClick={onDone}>
      <div className="continuing">
        <div className="continuing-date">{formatDate(currentDate)}</div>
        <div className="continuing-bar"><div className="continuing-fill" style={{ width: `${pct}%` }} /></div>
        <div className="continuing-list">
          {shown.map((n) => (
            <div key={n.id} className="continuing-item">
              <span className="kind">{newsKindLabel(n.kind)}</span>
              <span className="headline">{n.headline}</span>
            </div>
          ))}
        </div>
        <div className="continuing-hint">Click to skip</div>
      </div>
    </div>
  );
}
