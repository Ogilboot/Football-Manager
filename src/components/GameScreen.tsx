import { useState } from "react";
import { db } from "../game/data";
import { advanceWeek, finishSeason, startNextSeason, userPosition } from "../game/career";
import { formatDate, formatMoney } from "../game/format";
import type { CareerState, MatchdayReport } from "../game/types";
import { Dashboard } from "./Dashboard";
import { FixturesView } from "./FixturesView";
import { MatchdayModal } from "./MatchdayModal";
import { SeasonEndModal } from "./SeasonEndModal";
import { SquadView } from "./SquadView";
import { TableView } from "./TableView";
import { TransfersView } from "./TransfersView";

type Tab = "dashboard" | "squad" | "fixtures" | "table" | "transfers";

const TABS: { id: Tab; label: string }[] = [
  { id: "dashboard", label: "Home" },
  { id: "squad", label: "Squad" },
  { id: "fixtures", label: "Fixtures" },
  { id: "table", label: "League Table" },
  { id: "transfers", label: "Transfers" },
];

interface Props {
  career: CareerState;
  apply: (next: CareerState) => void;
  onExit: () => void;
}

export function GameScreen({ career, apply, onExit }: Props) {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [report, setReport] = useState<MatchdayReport | null>(null);

  const club = db.teamById.get(career.userClubId)!;
  const position = userPosition(career);
  const showSeasonEnd = career.seasonOver && !career.seasonEndPrizeAwarded;

  const playNext = () => {
    const { state, report: r } = advanceWeek(career);
    apply(state);
    setReport(r);
  };

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">Football <span>Manager</span></div>
        <div className="club">{club.name}</div>
        <div className="spacer" />
        <div className="info"><b>{formatDate(career.date)}</b></div>
        <div className="info">Budget <b>{formatMoney(career.balance)}</b></div>
        <div className="info">Pos <b>{position}</b></div>
        <button className="btn small" onClick={onExit}>Menu</button>
      </div>

      <div className="nav">
        {TABS.map((t) => (
          <div key={t.id} className={`nav-item ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
            {t.label}
          </div>
        ))}
      </div>

      <div className="content">
        {career.seasonOver && career.seasonEndPrizeAwarded && (
          <div className="banner">
            <div className="msg"><b>Season complete.</b> Start the new season when ready.</div>
            <button className="btn primary" onClick={() => apply(startNextSeason(career))}>Start next season</button>
          </div>
        )}
        {tab === "dashboard" && <Dashboard career={career} onPlay={playNext} />}
        {tab === "squad" && <SquadView career={career} apply={apply} />}
        {tab === "fixtures" && <FixturesView career={career} />}
        {tab === "table" && <TableView career={career} />}
        {tab === "transfers" && <TransfersView career={career} apply={apply} />}
      </div>

      {report && <MatchdayModal report={report} onClose={() => setReport(null)} />}
      {showSeasonEnd && (
        <SeasonEndModal
          career={career}
          position={position}
          onNextSeason={() => apply(startNextSeason(career))}
          onClose={() => {
            const finished = finishSeason(career);
            apply(finished);
            setReport(null);
          }}
        />
      )}
    </div>
  );
}
