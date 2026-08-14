import { db } from "../game/data";
import { boardConfidence, playerClub, playerOfSeason, topAssists, topScorers } from "../game/career";
import { formatMoney } from "../game/format";
import type { CareerState } from "../game/types";

interface Props {
  career: CareerState;
  position: number;
  onNextSeason: () => void;
  onClose: () => void;
}

function awardLine(label: string, playerId: number | undefined, detail: string) {
  if (playerId == null) return null;
  const p = db.players.get(playerId);
  if (!p) return null;
  return (
    <div className="award-row">
      <span className="muted small">{label}</span>
      <span style={{ fontWeight: 700 }}>{p.name}</span>
      <span className="muted small">{detail}</span>
    </div>
  );
}

export function SeasonEndModal({ career, position, onNextSeason, onClose }: Props) {
  const club = db.teamById.get(career.userClubId)!;
  const league = db.leagueByTeam.get(career.userClubId)!;
  const prize = Math.round((league.teams.length - position + 1) * 2_400_000);

  const boot = topScorers(career, 1)[0];
  const playmaker = topAssists(career, 1)[0];
  const potS = playerOfSeason(career);
  const bootClub = boot ? playerClub(career, boot.playerId) : null;
  const potSClub = potS ? playerClub(career, potS.playerId) : null;

  const objectiveMet = position <= career.boardObjective.targetPos;
  const projectedReputation = Math.max(0, Math.min(100, career.reputation + (objectiveMet ? 12 : -12)));

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>Season complete</h2>
        <p>
          {club.name} finished <b>{position}</b> in the {league.name}.
        </p>
        <p>Prize money: <b>{formatMoney(prize)}</b> has been added to your budget.</p>

        <div className="panel" style={{ marginTop: 12 }}>
          <div className="panel-title">Board verdict</div>
          <div className="award-row">
            <span className="muted small">Objective</span>
            <span style={{ fontWeight: 700 }}>{career.boardObjective.description}</span>
            <span className={`muted small ${objectiveMet ? "result W" : "result L"}`}>{objectiveMet ? "Met" : "Failed"}</span>
          </div>
          <div className="award-row">
            <span className="muted small">Board confidence</span>
            <span style={{ fontWeight: 700 }}>{boardConfidence(projectedReputation)}</span>
          </div>
        </div>

        <div className="panel" style={{ marginTop: 12, marginBottom: 0 }}>
          <div className="panel-title">Season awards</div>
          {awardLine("Golden Boot", boot?.playerId, `${boot?.goals} goals · ${bootClub != null ? db.teamById.get(bootClub)?.name : ""}`)}
          {awardLine("Playmaker", playmaker?.playerId, `${playmaker?.assists} assists`)}
          {awardLine("Player of the Season", potS?.playerId, `${potS?.rating.toFixed(2)} avg rating · ${potSClub != null ? db.teamById.get(potSClub)?.name : ""}`)}
        </div>

        <p className="muted small" style={{ marginTop: 12 }}>Squads have aged a year and players have developed over the off-season.</p>
        <div className="btn-row" style={{ marginTop: 16, justifyContent: "flex-end" }}>
          <button className="btn" onClick={onClose}>Review final table</button>
          <button className="btn primary" onClick={onNextSeason}>Start next season</button>
        </div>
      </div>
    </div>
  );
}
