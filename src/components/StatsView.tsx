import { db } from "../game/data";
import { playerClub, topAssists, topScorers } from "../game/career";
import type { CareerState } from "../game/types";
import { sortBy, useSort } from "../hooks/useSort";
import { SortHeader } from "./ui";

interface Row {
  playerId: number;
  goals: number;
  assists: number;
}

function PlayerTable({ career, rows, primary }: { career: CareerState; rows: Row[]; primary: "goals" | "assists" }) {
  const { sort, toggle } = useSort(primary);
  const sorted = sortBy(rows, sort, (r, key) => {
    switch (key) {
      case "player": return db.players.get(r.playerId)?.name.toLowerCase() ?? "";
      case "club": {
        const cid = playerClub(career, r.playerId);
        return cid != null ? db.teamById.get(cid)!.name : "";
      }
      case "goals": return r.goals;
      case "assists": return r.assists;
      default: return r.goals;
    }
  });

  return (
    <table className="table">
      <thead>
        <tr>
          <th className="num">#</th>
          <SortHeader label="Player" sortKey="player" sort={sort} onSort={toggle} />
          <SortHeader label="Club" sortKey="club" sort={sort} onSort={toggle} />
          <SortHeader label="G" sortKey="goals" sort={sort} onSort={toggle} num />
          <SortHeader label="A" sortKey="assists" sort={sort} onSort={toggle} num />
        </tr>
      </thead>
      <tbody>
        {sorted.map((r, i) => {
          const p = db.players.get(r.playerId);
          const clubId = playerClub(career, r.playerId);
          const club = clubId != null ? db.teamById.get(clubId) : null;
          return (
            <tr key={r.playerId}>
              <td className="num dim">{i + 1}</td>
              <td>{p?.name ?? "?"}</td>
              <td className="muted">{club?.name ?? "—"}</td>
              <td className="num" style={{ fontWeight: primary === "goals" ? 700 : 400 }}>{r.goals}</td>
              <td className="num" style={{ fontWeight: primary === "assists" ? 700 : 400 }}>{r.assists}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function StatsView({ career }: { career: CareerState }) {
  const scorers = topScorers(career, 10);
  const assists = topAssists(career, 10);
  return (
    <div className="grid cols-2">
      <div className="panel">
        <div className="panel-title">Top scorers</div>
        {scorers.length === 0 ? <div className="muted">No goals yet this season.</div> : <PlayerTable career={career} rows={scorers} primary="goals" />}
      </div>
      <div className="panel">
        <div className="panel-title">Top assists</div>
        {assists.length === 0 ? <div className="muted">No assists yet this season.</div> : <PlayerTable career={career} rows={assists} primary="assists" />}
      </div>
    </div>
  );
}
