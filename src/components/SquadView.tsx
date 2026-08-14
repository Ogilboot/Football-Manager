import { useMemo, useState } from "react";
import { getPlayerCurrent, releasePlayer, sellPlayer } from "../game/career";
import { formatMoney } from "../game/format";
import type { CareerState } from "../game/types";
import { PlayerPanel } from "./PlayerPanel";
import { RatingBadge } from "./ui";

const CAT_ORDER: Record<string, number> = { GK: 0, DF: 1, MF: 2, FW: 3 };

interface Props {
  career: CareerState;
  apply: (next: CareerState) => void;
}

export function SquadView({ career, apply }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const squad = useMemo(() => {
    const ids = career.squads[career.userClubId] ?? [];
    return ids
      .map((id) => ({ id, p: getPlayerCurrent(career, id) }))
      .sort((a, b) => (CAT_ORDER[a.p.category] - CAT_ORDER[b.p.category]) || b.p.ca - a.p.ca);
  }, [career]);

  const selectedPlayer = selected != null ? getPlayerCurrent(career, selected) : null;

  const doSell = (id: number) => {
    const out = sellPlayer(career, id);
    if (out.ok) { apply(out.state); setSelected(null); setFeedback(out.message); }
    else setFeedback(out.message);
  };
  const doRelease = (id: number) => {
    const out = releasePlayer(career, id);
    if (out.ok) { apply(out.state); setSelected(null); setFeedback(out.message); }
  };

  return (
    <div>
      {feedback && (
        <div className="banner">
          <div className="msg">{feedback}</div>
          <button className="btn small" onClick={() => setFeedback(null)}>OK</button>
        </div>
      )}

      <div className="panel">
        <div className="panel-title">Squad ({squad.length})</div>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th><th>Pos</th><th className="num">CA</th><th className="num">PA</th>
              <th className="num">Age</th><th className="num">Value</th><th className="num">Wage</th>
            </tr>
          </thead>
          <tbody>
            {squad.map(({ id, p }) => (
              <tr key={id} className="row-click" onClick={() => setSelected(id)}>
                <td>{p.name}</td>
                <td>{p.position}</td>
                <td className="num"><RatingBadge ca={p.ca} /></td>
                <td className="num dim">{p.pa}</td>
                <td className="num">{p.age}</td>
                <td className="num">{formatMoney(p.value)}</td>
                <td className="num dim">{formatMoney(p.wage)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedPlayer && selected != null && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <PlayerPanel player={selectedPlayer} />
            <div className="btn-row" style={{ marginTop: 16 }}>
              <button className="btn" onClick={() => doSell(selected)}>Sell ({formatMoney(Math.round(selectedPlayer.value * 0.85))})</button>
              <button className="btn danger" onClick={() => doRelease(selected)}>Release</button>
              <div className="spacer" style={{ flex: 1 }} />
              <button className="btn small" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
