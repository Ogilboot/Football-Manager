import { db } from "../game/data";
import { boardConfidence } from "../game/career";
import type { CareerState } from "../game/types";

export function ManagerView({ career }: { career: CareerState }) {
  const m = career.manager;
  const total = m.wins + m.draws + m.losses;
  const winPct = total ? Math.round((m.wins / total) * 100) : 0;

  return (
    <div>
      <div className="grid cols-3" style={{ marginBottom: 16 }}>
        <div className="kpi"><div className="stat"><span className="k">Reputation</span><span className="v">{career.reputation}</span></div></div>
        <div className="kpi"><div className="stat"><span className="k">Board confidence</span><span className="v" style={{ fontSize: 16 }}>{boardConfidence(career.reputation)}</span></div></div>
        <div className="kpi"><div className="stat"><span className="k">Trophies</span><span className="v">{m.trophies}</span></div></div>
      </div>

      <div className="panel">
        <div className="panel-title">Career record</div>
        <table className="table">
          <tbody>
            <tr><td className="muted">Seasons</td><td className="num" style={{ fontWeight: 700 }}>{m.seasons}</td></tr>
            <tr><td className="muted">Won</td><td className="num" style={{ color: "var(--accent)", fontWeight: 700 }}>{m.wins}</td></tr>
            <tr><td className="muted">Drawn</td><td className="num" style={{ color: "var(--warn)" }}>{m.draws}</td></tr>
            <tr><td className="muted">Lost</td><td className="num" style={{ color: "var(--danger)" }}>{m.losses}</td></tr>
            <tr><td className="muted">Win rate</td><td className="num">{winPct}%</td></tr>
          </tbody>
        </table>
      </div>

      <div className="panel">
        <div className="panel-title">Clubs managed</div>
        {m.clubs.map((id, i) => (
          <div key={id} className="small" style={{ padding: "2px 0" }}>
            {i + 1}. {db.teamById.get(id)?.name ?? "?"}
          </div>
        ))}
      </div>

      <div className="panel">
        <div className="panel-title">Board objective</div>
        <div style={{ fontWeight: 600 }}>{career.boardObjective.description}</div>
        <div className={`small ${career.boardObjective.status === "met" ? "result W" : career.boardObjective.status === "failed" ? "result L" : "muted"}`}>
          {career.boardObjective.status === "pending" ? "In progress" : career.boardObjective.status === "met" ? "Met" : "Failed"}
        </div>
      </div>
    </div>
  );
}
