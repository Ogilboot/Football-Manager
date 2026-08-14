import { useState } from "react";
import { db } from "../game/data";
import type { MatchLog, PlayerMatchStats, TeamMatchStats } from "../game/matchTypes";
import type { MatchdayReport, MatchResult } from "../game/types";
import { MatchView } from "./MatchView";

interface Props {
  report: MatchdayReport;
  userClubId: number;
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

function StatsGrid({ home, away }: { home: TeamMatchStats; away: TeamMatchStats }) {
  const rows: [string, string, string][] = [
    ["Possession", `${home.possession}%`, `${away.possession}%`],
    ["Shots", String(home.shots), String(away.shots)],
    ["On target", String(home.shotsOnTarget), String(away.shotsOnTarget)],
    ["xG", home.xg.toFixed(2), away.xg.toFixed(2)],
    ["Corners", String(home.corners), String(away.corners)],
    ["Pass accuracy", `${home.passAccuracy}%`, `${away.passAccuracy}%`],
    ["Fouls", String(home.fouls), String(away.fouls)],
    ["Cards", `${home.yellowCards}y / ${home.redCards}r`, `${away.yellowCards}y / ${away.redCards}r`],
  ];
  return (
    <table className="table match-stats">
      <tbody>
        <tr>
          <th></th>
          <th className="num">Home</th>
          <th className="num">Away</th>
        </tr>
        {rows.map(([label, h, a]) => (
          <tr key={label}>
            <td className="muted">{label}</td>
            <td className="num">{h}</td>
            <td className="num">{a}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RatingCell({ rating }: { rating: number }) {
  const cls = rating >= 7.6 ? "good" : rating >= 6.8 ? "ok" : rating >= 6.0 ? "mid" : "poor";
  return <span className={`rating-cell ${cls}`}>{rating.toFixed(1)}</span>;
}

function PlayerRatings({ log, teamId, isUser }: { log: MatchLog; teamId: number; isUser: boolean }) {
  const squad = teamId === log.context.home.teamId ? log.context.home : log.context.away;
  const ids = [...squad.lineup.map((s) => s.playerId), ...squad.bench];
  const entries = ids
    .map((id) => ({ id, p: db.players.get(id), ps: log.players[id] }))
    .filter((x): x is { id: number; p: NonNullable<typeof x.p>; ps: PlayerMatchStats } => !!x.p && !!x.ps)
    .sort((a, b) => b.ps.rating - a.ps.rating);

  return (
    <div className="panel">
      <div className="panel-title">
        {db.teamById.get(teamId)?.name}
        {isUser && <span className="you-tag">You</span>}
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Player</th>
            <th>Pos</th>
            <th className="num">Min</th>
            <th className="num">G</th>
            <th className="num">A</th>
            <th className="num">Saves</th>
            <th className="num">Rat</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(({ id, p, ps }) => (
            <tr key={id}>
              <td>{p.name}</td>
              <td className="muted">{p.position}</td>
              <td className="num">{ps.minutes}</td>
              <td className="num">{ps.goals || ""}</td>
              <td className="num">{ps.assists || ""}</td>
              <td className="num">{p.category === "GK" ? ps.saves || "" : ""}</td>
              <td className="num">
                <RatingCell rating={ps.rating} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MatchReport({ log, userClubId }: { log: MatchLog; userClubId: number }) {
  const homeTeamId = log.context.home.teamId;
  const awayTeamId = log.context.away.teamId;
  return (
    <div className="match-report">
      <div className="report-head">
        <div className="report-score">
          {db.teamById.get(homeTeamId)?.name}{" "}
          <b>
            {log.score.home}–{log.score.away}
          </b>{" "}
          {db.teamById.get(awayTeamId)?.name}
        </div>
      </div>
      <div className="grid cols-2" style={{ gap: 12 }}>
        <StatsGrid home={log.home} away={log.away} />
        <div className="goals-list">
          <div className="muted small" style={{ marginBottom: 4 }}>Goals</div>
          {log.events
            .filter((e): e is Extract<typeof e, { type: "goal" }> => e.type === "goal")
            .map((e, i) => (
              <div key={i} className="small">
                {e.minute}&apos; {db.players.get(e.playerId)?.name}
                {e.assistPlayerId != null && (
                  <span className="muted"> (assist {db.players.get(e.assistPlayerId)?.name})</span>
                )}
              </div>
            ))}
        </div>
      </div>
      <div className="grid cols-2" style={{ gap: 12, marginTop: 12 }}>
        <PlayerRatings log={log} teamId={homeTeamId} isUser={homeTeamId === userClubId} />
        <PlayerRatings log={log} teamId={awayTeamId} isUser={awayTeamId === userClubId} />
      </div>
    </div>
  );
}

export function MatchdayModal({ report, userClubId, onClose }: Props) {
  const [watching, setWatching] = useState(false);

  if (watching && report.userLog) {
    return <MatchView log={report.userLog} userClubId={userClubId} onClose={() => setWatching(false)} />;
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
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

        {report.userLog && (
          <>
            <h3 className="report-heading">Your match</h3>
            <div className="btn-row" style={{ marginBottom: 12 }}>
              <button className="btn primary" onClick={() => setWatching(true)}>Watch match</button>
            </div>
            <MatchReport log={report.userLog} userClubId={userClubId} />
          </>
        )}

        <div className="btn-row" style={{ marginTop: 16, justifyContent: "flex-end" }}>
          <button className="btn primary" onClick={onClose}>Continue</button>
        </div>
      </div>
    </div>
  );
}
