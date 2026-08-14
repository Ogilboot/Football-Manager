import { db } from "../game/data";
import type { MatchdayReport, MatchResult } from "../game/types";

interface Props {
  report: MatchdayReport;
  onClose: () => void;
}

function Scorers({ res, side }: { res: MatchResult; side: "home" | "away" }) {
  const scorers = side === "home" ? res.homeScorers : res.awayScorers;
  if (!scorers.length) return null;
  return (
    <div className="muted small">
      {scorers.map((s, i) => (
        <span key={i}>
          {i > 0 && ", "}
          {db.players.get(s.playerId)?.name} {s.minute}&apos;
        </span>
      ))}
    </div>
  );
}

export function MatchdayModal({ report, onClose }: Props) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Matchday {report.stage} results</h2>
        <table className="table">
          <tbody>
            {report.results.map((res) => {
              const home = db.teamById.get(res.homeId)!;
              const away = db.teamById.get(res.awayId)!;
              const isUser = res === report.userResult;
              return (
                <tr key={`${res.homeId}-${res.awayId}`} className={isUser ? "highlight" : ""}>
                  <td style={{ width: "50%" }}>
                    <div>{home.name}</div>
                    <Scorers res={res} side="home" />
                  </td>
                  <td className="num score" style={{ width: 60 }}>{res.homeGoals}–{res.awayGoals}</td>
                  <td style={{ width: "50%" }}>
                    <div>{away.name}</div>
                    <Scorers res={res} side="away" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="btn-row" style={{ marginTop: 16, justifyContent: "flex-end" }}>
          <button className="btn primary" onClick={onClose}>Continue</button>
        </div>
      </div>
    </div>
  );
}
