import { useEffect, useState } from "react";
import { newsKindLabel } from "../game/news";
import type { CareerState, NewsItem } from "../game/types";
import { NewsDetailModal } from "./NewsDetailModal";

export function NewsView({ career, onRead }: { career: CareerState; onRead: () => void }) {
  const [open, setOpen] = useState<NewsItem | null>(null);

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
            <div key={n.id} className={`news-item ${n.read ? "" : "unread"}`} onClick={() => setOpen(n)}>
              <div className="small muted">{n.date} · {newsKindLabel(n.kind)}</div>
              <div className="news-head">{n.headline}</div>
              <div className="muted small">{n.body}</div>
            </div>
          ))}
        </div>
      )}
      {open && <NewsDetailModal item={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
