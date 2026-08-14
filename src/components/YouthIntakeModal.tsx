import { db } from "../game/data";
import type { CareerState } from "../game/types";
import { CategoryBadge } from "./ui";

export function YouthIntakeModal({ career, onClose }: { career: CareerState; onClose: () => void }) {
  const ids = career.latestIntake;
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>Youth intake</h2>
        <p className="muted">Your academy has produced {ids.length} new prospect{ids.length === 1 ? "" : "s"}.</p>
        <table className="table">
          <thead>
            <tr>
              <th>Player</th>
              <th>Pos</th>
              <th className="num">Age</th>
              <th className="num">CA</th>
              <th className="num">PA</th>
            </tr>
          </thead>
          <tbody>
            {ids.map((id) => {
              const p = db.players.get(id);
              if (!p) return null;
              return (
                <tr key={id}>
                  <td>{p.name} <CategoryBadge cat={p.category} /></td>
                  <td className="muted">{p.position}</td>
                  <td className="num">{p.age}</td>
                  <td className="num">{p.ca}</td>
                  <td className="num dim">{p.pa}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="btn-row" style={{ marginTop: 16, justifyContent: "flex-end" }}>
          <button className="btn primary" onClick={onClose}>Welcome to the squad</button>
        </div>
      </div>
    </div>
  );
}
