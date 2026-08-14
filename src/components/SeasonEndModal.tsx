import { db } from "../game/data";
import { formatMoney } from "../game/format";
import type { CareerState } from "../game/types";

interface Props {
  career: CareerState;
  position: number;
  onNextSeason: () => void;
  onClose: () => void;
}

export function SeasonEndModal({ career, position, onNextSeason, onClose }: Props) {
  const club = db.teamById.get(career.userClubId)!;
  const league = db.leagueByTeam.get(career.userClubId)!;
  const prize = Math.round((league.teams.length - position + 1) * 2_400_000);

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>Season complete</h2>
        <p>
          {club.name} finished <b>{position}</b> in the {league.name}.
        </p>
        <p>Prize money: <b>{formatMoney(prize)}</b> has been added to your budget.</p>
        <p className="muted small">Squads have aged a year and players have developed over the off-season.</p>
        <div className="btn-row" style={{ marginTop: 16, justifyContent: "flex-end" }}>
          <button className="btn" onClick={onClose}>Review final table</button>
          <button className="btn primary" onClick={onNextSeason}>Start next season</button>
        </div>
      </div>
    </div>
  );
}
