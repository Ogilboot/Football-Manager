import { useState } from "react";
import { sellToClub, transferOffers } from "../game/career";
import { formatMoney } from "../game/format";
import type { CareerState } from "../game/types";

export function SellModal({ career, playerId, playerName, onClose, apply }: {
  career: CareerState;
  playerId: number;
  playerName: string;
  onClose: () => void;
  apply: (next: CareerState) => void;
}) {
  const offers = transferOffers(career, playerId);
  const [buyer, setBuyer] = useState<number | null>(offers[0]?.clubId ?? null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const selected = offers.find((o) => o.clubId === buyer);

  const submit = () => {
    if (buyer == null || !selected) { setFeedback("No interested clubs."); return; }
    const out = sellToClub(career, playerId, buyer, selected.fee);
    if (out.ok) { apply(out.state); onClose(); }
    else setFeedback(out.message);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="panel-title" style={{ marginBottom: 8 }}>Offer to clubs</div>
        <div className="small muted" style={{ marginBottom: 12 }}>{playerName}</div>

        {offers.length === 0 ? (
          <div className="small muted">No clubs are currently interested in this player.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Club</th>
                <th className="num">Bid</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {offers.map((o) => (
                <tr key={o.clubId} className={`row-click ${buyer === o.clubId ? "selected" : ""}`} onClick={() => setBuyer(o.clubId)}>
                  <td>{o.clubName}</td>
                  <td className="num">{formatMoney(o.fee)}</td>
                  <td className="num">{buyer === o.clubId ? "✓" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {feedback && (
          <div className="banner" style={{ marginBottom: 8 }}>
            <div className="msg">{feedback}</div>
          </div>
        )}
        <div className="btn-row" style={{ marginTop: 12 }}>
          <button className="btn primary" onClick={submit} disabled={!selected}>Accept {selected ? formatMoney(selected.fee) : ""}</button>
          <button className="btn small" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
