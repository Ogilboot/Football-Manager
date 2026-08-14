import { useMemo, useState } from "react";
import { db } from "../game/data";
import { teamStrength } from "../game/strength";

interface Props {
  onBack: () => void;
  onPick: (clubId: number, saveName: string) => void;
}

export function ClubSelect({ onBack, onPick }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const [saveName, setSaveName] = useState("My Career");

  const strengths = useMemo(() => {
    const m = new Map<number, number>();
    for (const t of db.teams) m.set(t.id, Math.round(teamStrength(db.squadOf.get(t.id) ?? [], (id) => db.players.get(id)!.ca)));
    return m;
  }, []);

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">Football <span>Manager</span></div>
        <div className="spacer" />
        <button className="btn small" onClick={onBack}>Back</button>
      </div>
      <div className="content">
        <div className="panel">
          <div className="panel-title">Choose your club</div>
          <div className="grid cols-2" style={{ alignItems: "end" }}>
            <div>
              <div className="muted small" style={{ marginBottom: 4 }}>Save name</div>
              <input
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>
            <div className="btn-row" style={{ justifyContent: "flex-end" }}>
              <button
                className="btn primary"
                disabled={selected == null || !saveName.trim()}
                onClick={() => selected != null && onPick(selected, saveName.trim())}
              >
                Confirm &amp; Start
              </button>
            </div>
          </div>
        </div>

        {db.leagues.map((league) => {
          const teams = db.teams.filter((t) => t.league === league.name);
          return (
            <div className="league-block" key={league.name}>
              <h3>{league.name} — {league.country}</h3>
              <div className="team-grid">
                {teams.map((t) => (
                  <div
                    key={t.id}
                    className={`team-card ${selected === t.id ? "selected" : ""}`}
                    onClick={() => setSelected(t.id)}
                  >
                    <div className="name">{t.name}</div>
                    <div className="meta">Squad {db.squadOf.get(t.id)?.length ?? 0} · Avg {strengths.get(t.id)}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
