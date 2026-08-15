import { useState } from "react";
import { askingPriceFor, contractDemand, makeTransferBid } from "../game/career";
import { formatMoney, formatWage } from "../game/format";
import type { CareerState } from "../game/types";

export function BidModal({ career, playerId, playerName, onClose, apply }: {
  career: CareerState;
  playerId: number;
  playerName: string;
  onClose: () => void;
  apply: (next: CareerState) => void;
}) {
  const asking = askingPriceFor(career, playerId);
  const isFree = asking === 0;

  const [length, setLength] = useState(3);
  const [fee, setFee] = useState(asking);
  const [wage, setWage] = useState(() => contractDemand(career, playerId, 3));
  const [feedback, setFeedback] = useState<string | null>(null);

  const demand = contractDemand(career, playerId, length);

  const changeLength = (n: number) => {
    setLength(n);
    setWage(contractDemand(career, playerId, n));
  };

  const submit = () => {
    const out = makeTransferBid(career, playerId, isFree ? 0 : fee, wage, length);
    if (out.ok) { apply(out.state); onClose(); }
    else setFeedback(out.message);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="panel-title" style={{ marginBottom: 8 }}>Make an offer</div>
        <div className="small muted" style={{ marginBottom: 12 }}>{playerName}</div>

        <div className="small muted" style={{ marginBottom: 12 }}>
          {isFree ? "Free agent — no transfer fee." : `Asking price: ${formatMoney(asking)}`}
        </div>

        {!isFree && (
          <div className="btn-row" style={{ marginBottom: 8 }}>
            <span className="small muted">Transfer fee</span>
            <input type="number" value={fee} min={0} step={500000} onChange={(e) => setFee(Number(e.target.value))} />
          </div>
        )}
        <div className="btn-row" style={{ marginBottom: 8 }}>
          <span className="small muted">Length</span>
          <select value={length} onChange={(e) => changeLength(Number(e.target.value))}>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} year{n > 1 ? "s" : ""}</option>)}
          </select>
        </div>
        <div className="small muted" style={{ marginBottom: 8 }}>Wage demand: {formatWage(demand)}/wk</div>
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
          <button className="btn primary" onClick={submit}>Submit bid</button>
          <button className="btn small" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
