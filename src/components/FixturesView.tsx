import { db } from "../game/data";
import { competitionName, fixturesFor } from "../game/career";
import type { CareerState, MatchResult } from "../game/types";
import { sortBy, useSort } from "../hooks/useSort";
import { SortHeader } from "./ui";

function letter(res: MatchResult, clubId: number): "W" | "D" | "L" {
  const gf = res.homeId === clubId ? res.homeGoals : res.awayGoals;
  const ga = res.homeId === clubId ? res.awayGoals : res.homeGoals;
  return gf > ga ? "W" : gf < ga ? "L" : "D";
}

interface Props {
  career: CareerState;
}

export function FixturesView({ career }: Props) {
  const clubId = career.userClubId;
  const { sort, toggle } = useSort("stage", "asc");

  const fixtures = sortBy(fixturesFor(career, clubId), sort, (f, key) => {
    switch (key) {
      case "stage": return f.stage;
      case "comp": return competitionName(f.competition);
      case "opponent": return db.teamById.get(f.homeId === clubId ? f.awayId : f.homeId)!.name.toLowerCase();
      case "ha": return f.homeId === clubId ? "H" : "A";
      case "result": {
        const res = career.results[f.id];
        if (!res) return "";
        const gf = res.homeId === clubId ? res.homeGoals : res.awayGoals;
        const ga = res.homeId === clubId ? res.awayGoals : res.homeGoals;
        return gf > ga ? "W" : gf < ga ? "L" : "D";
      }
      default: return f.stage;
    }
  });

  return (
    <div className="panel">
      <div className="panel-title">Fixtures &amp; Results</div>
      <table className="table">
        <thead>
          <tr>
            <SortHeader label="Stage" sortKey="stage" sort={sort} onSort={toggle} num />
            <SortHeader label="Comp" sortKey="comp" sort={sort} onSort={toggle} />
            <SortHeader label="Opponent" sortKey="opponent" sort={sort} onSort={toggle} />
            <SortHeader label="H/A" sortKey="ha" sort={sort} onSort={toggle} num />
            <th className="num">Score</th>
            <SortHeader label="Result" sortKey="result" sort={sort} onSort={toggle} num />
          </tr>
        </thead>
        <tbody>
          {fixtures.map((f) => {
            const res = career.results[f.id];
            const home = f.homeId === clubId;
            const opp = db.teamById.get(home ? f.awayId : f.homeId)!;
            return (
              <tr key={f.id} className={!res && f.stage === career.nextStage ? "highlight" : ""}>
                <td className="num dim">{f.stage}</td>
                <td className="muted">{competitionName(f.competition)}</td>
                <td>{opp.name}</td>
                <td className="num dim">{home ? "H" : "A"}</td>
                <td className="num score">
                  {res ? `${res.homeGoals}–${res.awayGoals}` : "–"}
                </td>
                <td className={`num ${res ? `result ${letter(res, clubId)}` : "dim"}`}>
                  {res ? letter(res, clubId) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
