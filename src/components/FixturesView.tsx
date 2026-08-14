import { db } from "../game/data";
import { competitionName, fixturesFor } from "../game/career";
import type { CareerState, MatchResult } from "../game/types";

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
  const fixtures = fixturesFor(career, clubId).sort((a, b) => a.stage - b.stage || a.competition.localeCompare(b.competition));

  return (
    <div className="panel">
      <div className="panel-title">Fixtures &amp; Results</div>
      <table className="table">
        <thead>
          <tr>
            <th className="num">Stage</th>
            <th>Comp</th>
            <th>Opponent</th>
            <th className="num">H/A</th>
            <th className="num">Score</th>
            <th className="num">Result</th>
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
