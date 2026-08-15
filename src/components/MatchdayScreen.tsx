import { useState } from "react";
import { db } from "../game/data";
import { competitionName, getPlayerCurrent, getPlayerState, nextUserFixture, oppositionReport, setTactics } from "../game/career";
import { formatDate } from "../game/format";
import { FORMATIONS, getFormation } from "../game/formations";
import { getRole } from "../game/roles";
import { assignPlayer, pickLineup } from "../game/teamSelection";
import type { CareerState } from "../game/types";
import { AbilityStars, FormDots } from "./ui";

export function MatchdayScreen({ state, setState, onStart }: {
  state: CareerState;
  setState: (next: CareerState) => void;
  onStart: () => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);

  const fixture = nextUserFixture(state);
  if (!fixture) return null;

  const clubId = state.userClubId;
  const club = db.teamById.get(clubId)!;
  const home = fixture.homeId === clubId;
  const opp = db.teamById.get(home ? fixture.awayId : fixture.homeId)!;
  const report = oppositionReport(state, fixture);

  const squad = state.squads[clubId] ?? [];
  const caOf = (id: number) => getPlayerCurrent(state, id).ca;
  const formation = getFormation(state.tactics.formationId);
  const lineup = state.tactics.lineup;
  const bench = state.tactics.bench;

  const changeFormation = (fid: string) => {
    const { lineup: li, bench: be } = pickLineup(squad, getFormation(fid), caOf);
    setState(setTactics(state, { formationId: fid, instructions: state.tactics.instructions, lineup: li, bench: be }));
  };

  const autoPick = () => {
    const { lineup: li, bench: be } = pickLineup(squad, formation, caOf);
    setState(setTactics(state, { ...state.tactics, lineup: li, bench: be }));
  };

  const clickPlayer = (id: number) => {
    if (selected == null) { setSelected(id); return; }
    if (selected === id) { setSelected(null); return; }
    const t = state.tactics;
    const area = t.lineup.includes(selected) ? "lineup" : "bench";
    const idx = area === "lineup" ? t.lineup.indexOf(selected) : t.bench.indexOf(selected);
    setState(setTactics(state, assignPlayer(t, area, idx, id)));
    setSelected(null);
  };

  const status = (id: number) => {
    const ps = getPlayerState(state, id);
    if (ps.injured || ps.injuryDaysLeft > 0) return <span className="badge-flag injured">Injured</span>;
    if (ps.suspended > 0) return <span className="badge-flag suspended">Suspended</span>;
    return null;
  };

  const PlayerRow = ({ id, role }: { id: number | undefined; role?: string }) => {
    if (id == null) return <div className="matchday-player dim">—</div>;
    const p = getPlayerCurrent(state, id);
    return (
      <div className={`matchday-player ${selected === id ? "selected" : ""}`} onClick={() => clickPlayer(id)}>
        {role && <span className="role">{role}</span>}
        <span className="pos">{p.position}</span>
        <span className="name">{p.name}</span>
        {status(id)}
      </div>
    );
  };

  return (
    <div className="continuing-backdrop">
      <div className="matchday">
        <div className="matchday-head">
          <div className="matchday-title">Matchday</div>
          <div className="matchday-fixture">
            <span className={home ? "team strong" : "team"}>{club.name}</span>
            <span className="vs">vs</span>
            <span className={!home ? "team strong" : "team"}>{opp.name}</span>
            <span className="muted small"> · {competitionName(fixture.competition)} · {home ? "Home" : "Away"} · {formatDate(state.date)}</span>
          </div>
        </div>

        <div className="matchday-body">
          <div className="panel">
            <div className="panel-title">Opposition report</div>
            <div className="opp-summary">{report.summary}</div>
            <div className="opp-grid">
              <div className="opp-cell"><div className="k">Formation</div><div className="v">{report.formationId}</div></div>
              <div className="opp-cell"><div className="k">League position</div><div className="v">{report.position != null ? `${report.position}` : "—"}</div></div>
              <div className="opp-cell"><div className="k">Recent form</div><div className="v"><FormDots form={report.form} /></div></div>
            </div>
            <div className="panel-title" style={{ marginTop: 8 }}>Key players</div>
            <div className="opp-key">
              {report.keyPlayers.map((k) => (
                <div key={k.name} className="opp-key-item">
                  <span className="pos">{k.position}</span>
                  <span className="name">{k.name}</span>
                  <AbilityStars ca={k.ca} pa={k.ca} />
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-title">Matchday squad</div>
            <div className="btn-row" style={{ flexWrap: "wrap", marginBottom: 8 }}>
              {FORMATIONS.map((f) => (
                <button key={f.id} className={`btn small ${f.id === formation.id ? "primary" : ""}`} onClick={() => changeFormation(f.id)}>{f.name}</button>
              ))}
              <div className="spacer" />
              <button className="btn small" onClick={autoPick}>Auto-pick</button>
            </div>
            <div className="muted small" style={{ marginBottom: 8 }}>Click a player, then another to swap them.</div>
            <div className="matchday-squads">
              <div>
                <div className="panel-title" style={{ marginBottom: 4 }}>Starting XI</div>
                {formation.slots.map((slot, i) => (
                  <PlayerRow key={i} id={lineup[i]} role={getRole(slot.roleId).name} />
                ))}
              </div>
              <div>
                <div className="panel-title" style={{ marginBottom: 4 }}>Bench</div>
                {bench.map((id, i) => <PlayerRow key={i} id={id} />)}
              </div>
            </div>
          </div>
        </div>

        <div className="matchday-foot">
          <button className="btn primary" onClick={onStart}>Start match</button>
        </div>
      </div>
    </div>
  );
}
