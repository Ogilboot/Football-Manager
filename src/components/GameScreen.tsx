import { useState } from "react";
import { db } from "../game/data";
import { advanceWeek, clearLatestIntake, finishSeason, markAllNewsRead, startNextSeason, userPosition } from "../game/career";
import { formatDate, formatMoney } from "../game/format";
import type { CareerState, MatchdayReport } from "../game/types";
import type { MatchLog } from "../game/matchTypes";
import { Dashboard } from "./Dashboard";
import { FixturesView } from "./FixturesView";
import { MatchdayModal } from "./MatchdayModal";
import { MatchView } from "./MatchView";
import { NewsView } from "./NewsView";
import { SeasonEndModal } from "./SeasonEndModal";
import { SquadView } from "./SquadView";
import { StatsView } from "./StatsView";
import { TableView } from "./TableView";
import { TransfersView } from "./TransfersView";
import { TacticsView } from "./TacticsView";
import { YouthIntakeModal } from "./YouthIntakeModal";
import { teamColor } from "../game/teamColors";

type Tab = "dashboard" | "squad" | "tactics" | "fixtures" | "table" | "stats" | "scouting" | "news";

const TABS: { id: Tab; label: string }[] = [
  { id: "dashboard", label: "Home" },
  { id: "squad", label: "Squad" },
  { id: "tactics", label: "Tactics" },
  { id: "fixtures", label: "Fixtures" },
  { id: "table", label: "League Table" },
  { id: "stats", label: "Stats" },
  { id: "scouting", label: "Scouting" },
  { id: "news", label: "News" },
];

interface Props {
  career: CareerState;
  apply: (next: CareerState) => void;
  onExit: () => void;
}

export function GameScreen({ career, apply, onExit }: Props) {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [report, setReport] = useState<MatchdayReport | null>(null);
  const [watchLog, setWatchLog] = useState<MatchLog | null>(null);

  const club = db.teamById.get(career.userClubId)!;
  const position = userPosition(career);
  const showSeasonEnd = career.seasonOver && !career.seasonEndPrizeAwarded;
  const unreadNews = career.inbox.filter((n) => !n.read).length;
  const sectionTitle = TABS.find((t) => t.id === tab)?.label ?? "";
  const leagueName = db.leagueByTeam.get(career.userClubId)?.name ?? "";
  let hue = 0;
  for (const c of club.name) hue = (hue * 31 + c.charCodeAt(0)) % 360;
  const badgeColor = teamColor(club.name) ?? `hsl(${hue}, 52%, 40%)`;

  const playNext = () => {
    if (career.seasonOver) return;
    const { state, report: r } = advanceWeek(career);
    apply(state);
    setReport(r);
    setWatchLog(r.userLog);
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="side-brand">
          <span className="club-badge" style={{ background: badgeColor }}>{club.shortName ?? club.name.slice(0, 3).toUpperCase()}</span>
          <div>
            <div className="side-club">{club.name}</div>
            <div className="side-sub">{leagueName}</div>
          </div>
        </div>
        <nav className="side-nav">
          {TABS.map((t) => (
            <div key={t.id} className={`side-item ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
              <span>{t.label}</span>
              {t.id === "news" && unreadNews > 0 && <span className="nav-badge">{unreadNews}</span>}
            </div>
          ))}
        </nav>
        <div className="side-foot">
          <button className="btn small" onClick={onExit}>Exit to Menu</button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-title">{sectionTitle}</div>
          <div className="spacer" />
          <div className="info">{formatDate(career.date)}</div>
          <div className="info">Budget <b>{formatMoney(career.balance)}</b></div>
          <div className="info">Pos <b>{position}</b></div>
          <button className="btn continue" onClick={playNext} disabled={career.seasonOver}>{career.seasonOver ? "Season Over" : "Continue"}</button>
        </header>

        <div className="content">
          {career.seasonOver && career.seasonEndPrizeAwarded && (
            <div className="banner">
              <div className="msg"><b>Season complete.</b> Start the new season when ready.</div>
              <button className="btn primary" onClick={() => apply(startNextSeason(career))}>Start next season</button>
            </div>
          )}
          {tab === "dashboard" && <Dashboard career={career} onPlay={playNext} />}
          {tab === "squad" && <SquadView career={career} apply={apply} />}
          {tab === "tactics" && <TacticsView career={career} apply={apply} />}
          {tab === "fixtures" && <FixturesView career={career} />}
          {tab === "table" && <TableView career={career} />}
          {tab === "stats" && <StatsView career={career} />}
          {tab === "scouting" && <TransfersView career={career} apply={apply} />}
          {tab === "news" && <NewsView career={career} onRead={() => apply(markAllNewsRead(career))} />}
        </div>
      </div>

      {watchLog && (
        <MatchView log={watchLog} userClubId={career.userClubId} onClose={() => setWatchLog(null)} />
      )}
      {report && !watchLog && (
        <MatchdayModal report={report} userClubId={career.userClubId} onClose={() => setReport(null)} />
      )}
      {showSeasonEnd && !watchLog && (
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
      {career.latestIntake.length > 0 && !watchLog && (
        <YouthIntakeModal career={career} onClose={() => apply(clearLatestIntake(career))} />
      )}
    </div>
  );
}
