import { db } from "../game/data";
import { leagueStandings, teamRecentForm } from "../game/career";
import type { CareerState } from "../game/types";
import { FormDots } from "./ui";

interface Props {
  career: CareerState;
}

export function TableView({ career }: Props) {
  const clubId = career.userClubId;
  const league = db.leagueByTeam.get(clubId);
  const standings = leagueStandings(career);

  return (
    <div className="panel">
      <div className="panel-title">{league?.name ?? "League"} table</div>
      <table className="table">
        <thead>
          <tr>
            <th className="num">#</th><th>Club</th><th className="num">P</th><th className="num">W</th>
            <th className="num">D</th><th className="num">L</th><th className="num">GD</th>
            <th className="num">Pts</th><th>Form</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((r, i) => {
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
