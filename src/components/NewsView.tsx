import { useEffect } from "react";
import type { CareerState } from "../game/types";

const KIND_LABELS: Record<string, string> = {
  result: "Match result",
  injury: "Injury",
  suspension: "Suspension",
  transfer: "Transfer",
  award: "Award",
  intake: "Youth intake",
  info: "Club",
};

export function NewsView({ career, onRead }: { career: CareerState; onRead: () => void }) {
  useEffect(() => {
    if (career.inbox.some((n) => !n.read)) onRead();
  }, [career, onRead]);

  return (
    <div className="panel">
      <div className="panel-title">Inbox</div>
      {career.inbox.length === 0 ? (
        <div className="muted">No news.</div>
      ) : (
        <div>
          {career.inbox.map((n) => (
            <div key={n.id} className={`news-item ${n.read ? "" : "unread"}`}>
              <div className="small muted">{n.date} · {KIND_LABELS[n.kind] ?? n.kind}</div>
              <div className="news-head">{n.headline}</div>
              <div className="muted small">{n.body}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
