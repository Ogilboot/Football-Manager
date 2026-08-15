import { db } from "../game/data";
import { moveClub } from "../game/career";
import type { CareerState } from "../game/types";

interface Props {
  career: CareerState;
  apply: (next: CareerState) => void;
  onRetire: () => void;
  onStay: () => void;
}

export function ManagerCareerModal({ career, apply, onRetire, onStay }: Props) {
  const club = db.teamById.get(career.userClubId)!;
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>{career.sacked ? `Sacked by ${club.name}` : "Job offer"}</h2>
        {career.sacked ? (
          <p>The board have relieved you of your duties after a disappointing season.</p>
        ) : (
          <p>You have attracted the attention of other clubs.</p>
        )}

        <div className="panel-title" style={{ marginTop: 8 }}>Job offers</div>
        {career.jobOffers.length === 0 ? (
          <p className="muted">No clubs are currently interested in your services.</p>
        ) : (
          career.jobOffers.map((id) => {
            const t = db.teamById.get(id);
            if (!t) return null;
            return (
              <div key={id} className="banner">
                <div className="msg"><b>{t.name}</b></div>
                <button className="btn primary" onClick={() => apply(moveClub(career, id))}>Accept</button>
              </div>
            );
          })
        )}

        <div className="btn-row" style={{ marginTop: 16, justifyContent: "flex-end" }}>
          {career.sacked ? (
            <button className="btn danger" onClick={onRetire}>Retire from management</button>
          ) : (
            <button className="btn" onClick={onStay}>Stay at {club.name}</button>
          )}
        </div>
      </div>
    </div>
  );
}
