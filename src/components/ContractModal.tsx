import { useState } from "react";
import { contractDemand, negotiateContract } from "../game/career";
import { formatWage } from "../game/format";
import type { CareerState } from "../game/types";

export function ContractModal({ career, playerId, playerName, onClose, apply }: {
  career: CareerState;
  playerId: number;
  playerName: string;
  onClose: () => void;
  apply: (next: CareerState) => void;
}) {
  const [length, setLength] = useState(3);
  const [wage, setWage] = useState(() => contractDemand(career, playerId, 3));
  const [feedback, setFeedback] = useState<string | null>(null);

  const demand = contractDemand(career, playerId, length);
  const refusing = demand === Infinity;

  const changeLength = (n: number) => {
    setLength(n);
    setWage(contractDemand(career, playerId, n));
  };

  const submit = () => {
    const out = negotiateContract(career, playerId, wage, length);
    if (out.ok) { apply(out.state); onClose(); }
    else setFeedback(out.message);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="panel-title" style={{ marginBottom: 8 }}>Contract negotiation</div>
        <div className="small muted" style={{ marginBottom: 12 }}>{playerName}</div>

        {refusing ? (
          <div className="small" style={{ color: "var(--warn)" }}>The player is not willing to discuss a new contract right now.</div>
        ) : (
          <>
            <div className="small muted" style={{ marginBottom: 12 }}>Asks for {formatWage(demand)} per week.</div>
            <div className="btn-row" style={{ marginBottom: 8 }}>
              <span className="small muted">Length</span>
              <select value={length} onChange={(e) => changeLength(Number(e.target.value))}>
                {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} year{n > 1 ? "s" : ""}</option>)}
              </select>
            </div>
            <div className="btn-row" style={{ marginBottom: 8 }}>
              <span className="small muted">Weekly wage</span>
              <input type="number" value={wage} min={500} step={100} onChange={(e) => setWage(Number(e.target.value))} />
            </div>
            {feedback && (
              <div className="banner" style={{ marginBottom: 8 }}>
                <div className="msg">{feedback}</div>
              </div>
            )}
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button className="btn primary" onClick={submit}>Offer contract</button>
              <button className="btn small" onClick={onClose}>Close</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
