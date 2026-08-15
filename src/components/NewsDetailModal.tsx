import { db } from "../game/data";
import { newsKindLabel } from "../game/news";
import type { NewsItem } from "../game/types";

export function NewsDetailModal({ item, onClose }: { item: NewsItem; onClose: () => void }) {
  const player = item.playerId != null ? db.players.get(item.playerId) : null;
  const team = item.teamId != null ? db.teamById.get(item.teamId) : null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="news-detail-meta">
          <span className="news-detail-kind">{newsKindLabel(item.kind)}</span>
          <span className="muted small">{item.date}</span>
        </div>
        <h2>{item.headline}</h2>
        <p>{item.detail}</p>

        {(player || team) && (
          <div className="news-detail-extra">
            {player && (
              <div><span className="muted small">Player</span><span> {player.name} · {player.position}</span></div>
            )}
            {team && (
              <div><span className="muted small">Club</span><span> {team.name}</span></div>
            )}
          </div>
        )}

        <div className="btn-row" style={{ marginTop: 16, justifyContent: "flex-end" }}>
          <button className="btn primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
