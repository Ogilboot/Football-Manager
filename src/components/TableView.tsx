import { db } from "../game/data";
import { leagueStandings, teamRecentForm } from "../game/career";
import type { CareerState } from "../game/types";
import { sortBy, useSort } from "../hooks/useSort";
import { FormDots, SortHeader } from "./ui";

interface Props {
  career: CareerState;
}

export function TableView({ career }: Props) {
  const clubId = career.userClubId;
  const league = db.leagueByTeam.get(clubId);
  const { sort, toggle } = useSort("points");

  const rows = sortBy(leagueStandings(career), sort, (r, key) => {
    switch (key) {
      case "club": return db.teamById.get(r.teamId)!.name.toLowerCase();
      case "played": return r.played;
      case "won": return r.won;
      case "drawn": return r.drawn;
      case "lost": return r.lost;
      case "gd": return r.gf - r.ga;
      case "points": return r.points;
      case "form": {
        const f = teamRecentForm(career, r.teamId, 5);
        return f.filter((x) => x === "W").length - f.filter((x) => x === "L").length;
      }
      default: return r.points;
    }
  });

  return (
    <div className="panel">
      <div className="panel-title">{league?.name ?? "League"} table</div>
      <table className="table">
        <thead>
          <tr>
            <th className="num">#</th>
            <SortHeader label="Club" sortKey="club" sort={sort} onSort={toggle} />
            <SortHeader label="P" sortKey="played" sort={sort} onSort={toggle} num />
            <SortHeader label="W" sortKey="won" sort={sort} onSort={toggle} num />
            <SortHeader label="D" sortKey="drawn" sort={sort} onSort={toggle} num />
            <SortHeader label="L" sortKey="lost" sort={sort} onSort={toggle} num />
            <SortHeader label="GD" sortKey="gd" sort={sort} onSort={toggle} num />
            <SortHeader label="Pts" sortKey="points" sort={sort} onSort={toggle} num />
            <SortHeader label="Form" sortKey="form" sort={sort} onSort={toggle} />
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const t = db.teamById.get(r.teamId)!;
            const form = teamRecentForm(career, r.teamId, 5);
            return (
              <tr key={r.teamId} className={r.teamId === clubId ? "highlight" : ""}>
                <td className="num">{i + 1}</td>
                <td>{t.name}</td>
                <td className="num">{r.played}</td>
                <td className="num">{r.won}</td>
                <td className="num">{r.drawn}</td>
                <td className="num">{r.lost}</td>
                <td className="num">{r.gf - r.ga}</td>
                <td className="num" style={{ fontWeight: 700 }}>{r.points}</td>
                <td><FormDots form={form} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
