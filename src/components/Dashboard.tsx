import { useState } from "react";
import { db } from "../game/data";
import { boardConfidence, fixturesFor, leagueStandings, nextUserFixture, teamRecentForm, weeklyIncome, weeklyWages } from "../game/career";
import { formatMoney, formatWage } from "../game/format";
import { newsKindLabel } from "../game/news";
import type { CareerState, MatchResult, NewsItem } from "../game/types";
import { NewsDetailModal } from "./NewsDetailModal";
import { FormDots } from "./ui";

function resultLetter(res: MatchResult, clubId: number): "W" | "D" | "L" {
  const gf = res.homeId === clubId ? res.homeGoals : res.awayGoals;
  const ga = res.homeId === clubId ? res.awayGoals : res.homeGoals;
  return gf > ga ? "W" : gf < ga ? "L" : "D";
}

interface Props {
  career: CareerState;
  onPlay: () => void;
}

export function Dashboard({ career, onPlay }: Props) {
  const [openNews, setOpenNews] = useState<NewsItem | null>(null);
  const clubId = career.userClubId;
  const club = db.teamById.get(clubId)!;
  const next = nextUserFixture(career);
  const opponent = next ? db.teamById.get(next.homeId === clubId ? next.awayId : next.homeId)! : null;
  const home = next ? next.homeId === clubId : false;

  const wages = weeklyWages(career);
  const fixtures = fixturesFor(career, clubId);
  const played = fixtures.filter((f) => career.results[f.id]).sort((a, b) => b.stage - a.stage).slice(0, 5);
  const upcoming = fixtures.filter((f) => !career.results[f.id]).sort((a, b) => a.stage - b.stage).slice(0, 5);

  const standings = leagueStandings(career);
  const top5 = standings.slice(0, 5);
  const myRow = standings.find((r) => r.teamId === clubId);

  return (
    <div>
      <div className="grid cols-3" style={{ marginBottom: 16 }}>
        <div className="kpi"><div className="stat"><span className="k">Transfer budget</span><span className="v">{formatMoney(career.balance)}</span></div></div>
        <div className="kpi"><div className="stat"><span className="k">Wage bill</span><span className="v" style={{ fontSize: 16 }}>{formatWage(wages)}</span></div></div>
        <div className="kpi"><div className="stat"><span className="k">League position</span><span className="v">{standings.findIndex((r) => r.teamId === clubId) + 1}</span></div></div>
      </div>

      <div className="panel" style={{ padding: "12px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div className="stat">
            <span className="k">Board objective</span>
            <span className="v" style={{ fontSize: 15 }}>{career.boardObjective.description}</span>
          </div>
          <div className="stat">
            <span className="k">Board confidence</span>
            <span className="v" style={{ fontSize: 15 }}>{boardConfidence(career.reputation)}</span>
          </div>
          <div className="stat">
            <span className="k">Reputation</span>
            <span className="v" style={{ fontSize: 15 }}>{career.reputation}</span>
          </div>
          <div className="stat">
            <span className="k">Weekly income / wages</span>
            <span className="v" style={{ fontSize: 15 }}>{formatMoney(weeklyIncome(career))} / {formatWage(wages)}</span>
          </div>
        </div>
      </div>

      {next && opponent ? (
        <div className="banner">
          <div className="msg">
            <div className="muted small">Next match</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>
              {home ? club.name : opponent.name} vs {home ? opponent.name : club.name}
            </div>
            <div className="small" style={{ marginTop: 4 }}>
              <span className="muted">Form: </span>
              <FormDots form={teamRecentForm(career, clubId, 5)} />
            </div>
          </div>
          <button className="btn primary" onClick={onPlay}>Play Match</button>
        </div>
      ) : career.seasonOver ? (
        <div className="banner"><div className="msg"><b>Season complete</b> — review the final table.</div></div>
      ) : null}

      <div className="panel">
        <div className="panel-title">News</div>
        {career.inbox.length === 0 ? (
          <div className="muted">No news.</div>
        ) : (
          <div>
            {career.inbox.slice(0, 5).map((n) => (
              <div key={n.id} className="news-item" onClick={() => setOpenNews(n)}>
                <div className="small muted">{n.date} · {newsKindLabel(n.kind)}</div>
                <div className="news-head">{n.headline}</div>
                <div className="muted small">{n.body}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid cols-2">
        <div className="panel">
          <div className="panel-title">Recent results</div>
          {played.length === 0 ? (
            <div className="muted">No matches played yet.</div>
          ) : (
            <table className="table">
              <tbody>
                {played.map((f) => {
                  const opp = db.teamById.get(f.homeId === clubId ? f.awayId : f.homeId)!;
                  const res = career.results[f.id];
                  const gf = res.homeId === clubId ? res.homeGoals : res.awayGoals;
                  const ga = res.homeId === clubId ? res.awayGoals : res.homeGoals;
                  return (
                    <tr key={f.id}>
                      <td className="dim small">MD{f.stage}</td>
                      <td>{f.homeId === clubId ? "v" : "a"} {opp.name}</td>
                      <td className="num score">{gf}–{ga}</td>
                      <td className={`num result ${resultLetter(res, clubId)}`}>{resultLetter(res, clubId)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="panel">
          <div className="panel-title">Fixtures</div>
          {upcoming.length === 0 ? (
            <div className="muted">Season finished.</div>
          ) : (
            <table className="table">
              <tbody>
                {upcoming.map((f) => {
                  const opp = db.teamById.get(f.homeId === clubId ? f.awayId : f.homeId)!;
                  return (
                    <tr key={f.id}>
                      <td className="dim small">MD{f.stage}</td>
                      <td>{f.homeId === clubId ? "v" : "a"} {opp.name}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">League table</div>
        <table className="table">
          <thead>
            <tr>
              <th className="num">#</th><th>Club</th><th className="num">P</th><th className="num">GD</th><th className="num">Pts</th>
            </tr>
          </thead>
          <tbody>
            {top5.map((r, i) => (
              <tr key={r.teamId} className={r.teamId === clubId ? "highlight" : ""}>
                <td className="num">{i + 1}</td>
                <td>{db.teamById.get(r.teamId)!.name}</td>
                <td className="num">{r.played}</td>
                <td className="num">{r.gf - r.ga}</td>
                <td className="num" style={{ fontWeight: 700 }}>{r.points}</td>
              </tr>
            ))}
            {myRow && myRow.played > 0 && (
              <tr className="highlight">
                <td className="num">{standings.indexOf(myRow) + 1}</td>
                <td>{club.name}</td>
                <td className="num">{myRow.played}</td>
                <td className="num">{myRow.gf - myRow.ga}</td>
                <td className="num" style={{ fontWeight: 700 }}>{myRow.points}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {openNews && <NewsDetailModal item={openNews} onClose={() => setOpenNews(null)} />}
    </div>
  );
}
