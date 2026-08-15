import { useState } from "react";
import { getPlayerCurrent, setTactics } from "../game/career";
import { FORMATIONS, getFormation } from "../game/formations";
import { DEFENSIVE_LINES, MENTALITIES, PASSING_STYLES, PRESSING_LEVELS, TEMPOS, WIDTHS } from "../game/instructions";
import { getRole } from "../game/roles";
import { assignPlayer, pickLineup } from "../game/teamSelection";
import type { CareerState, TeamInstructions } from "../game/types";
import { AbilityStars } from "./ui";

interface Props {
  career: CareerState;
  apply: (next: CareerState) => void;
}

function shortName(name: string): string {
  const parts = name.split(" ");
  return parts.length > 1 ? parts[parts.length - 1] : name;
}

function PitchBackground() {
  return (
    <svg viewBox="0 0 68 105" className="tactics-pitch-svg" preserveAspectRatio="none">
      {Array.from({ length: 7 }, (_, i) => (
        <rect key={i} y={i * 15} width="68" height="15" fill={i % 2 ? "#1c5e34" : "#216b3b"} />
      ))}
      <g stroke="rgba(255,255,255,0.7)" fill="none" strokeWidth="0.5">
        <rect x="1" y="1" width="66" height="103" />
        <line x1="1" y1="52.5" x2="67" y2="52.5" />
        <circle cx="34" cy="52.5" r="9.15" />
        <rect x="13.85" y="1" width="40.3" height="16.5" />
        <rect x="13.85" y="87.5" width="40.3" height="16.5" />
        <rect x="24.85" y="1" width="18.3" height="5.5" />
        <rect x="24.85" y="98.5" width="18.3" height="5.5" />
        <circle cx="34" cy="11" r="0.5" fill="rgba(255,255,255,0.7)" />
        <circle cx="34" cy="94" r="0.5" fill="rgba(255,255,255,0.7)" />
      </g>
      <g stroke="#fff" strokeWidth="1">
        <line x1="30.34" y1="0.5" x2="37.66" y2="0.5" />
        <line x1="30.34" y1="104.5" x2="37.66" y2="104.5" />
      </g>
    </svg>
  );
}

export function TacticsView({ career, apply }: Props) {
  const clubId = career.userClubId;
  const squad = career.squads[clubId] ?? [];
  const caOf = (id: number) => getPlayerCurrent(career, id).ca;

  const [dragId, setDragId] = useState<number | null>(null);

  const formation = getFormation(career.tactics.formationId);
  const lineup = career.tactics.lineup;
  const bench = career.tactics.bench;

  const squadPlayers = [...squad]
    .map((id) => ({ id, p: getPlayerCurrent(career, id) }))
    .sort((a, b) => b.p.ca - a.p.ca);

  const changeFormation = (fid: string) => {
    const { lineup: li, bench: be } = pickLineup(squad, getFormation(fid), caOf);
    apply(setTactics(career, { formationId: fid, instructions: career.tactics.instructions, lineup: li, bench: be }));
  };

  const changeInstruction = (key: keyof TeamInstructions, value: string) => {
    const instructions = { ...career.tactics.instructions, [key]: value } as TeamInstructions;
    apply(setTactics(career, { ...career.tactics, instructions }));
  };

  const autoPick = () => {
    const { lineup: li, bench: be } = pickLineup(squad, getFormation(career.tactics.formationId), caOf);
    apply(setTactics(career, { ...career.tactics, lineup: li, bench: be }));
  };

  const dropOnSlot = (index: number) => {
    if (dragId == null) return;
    apply(setTactics(career, assignPlayer(career.tactics, "lineup", index, dragId)));
    setDragId(null);
  };

  const dropOnBench = (index: number) => {
    if (dragId == null) return;
    apply(setTactics(career, assignPlayer(career.tactics, "bench", index, dragId)));
    setDragId(null);
  };

  const dragStart = (e: React.DragEvent, id: number) => {
    e.dataTransfer.setData("text/plain", String(id));
    setDragId(id);
  };

  const Instruction = ({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) => (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span className="muted small">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );

  return (
    <div>
      <div className="panel">
        <div className="panel-title">Formation</div>
        <div className="btn-row" style={{ flexWrap: "wrap" }}>
          {FORMATIONS.map((f) => (
            <button key={f.id} className={`btn small ${f.id === formation.id ? "primary" : ""}`} onClick={() => changeFormation(f.id)}>
              {f.name}
            </button>
          ))}
          <div className="spacer" />
          <button className="btn small" onClick={autoPick}>Auto-pick</button>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">Team instructions</div>
        <div className="grid cols-3">
          <Instruction label="Mentality" value={career.tactics.instructions.mentality} options={[...MENTALITIES]} onChange={(v) => changeInstruction("mentality", v)} />
          <Instruction label="Passing" value={career.tactics.instructions.passingStyle} options={[...PASSING_STYLES]} onChange={(v) => changeInstruction("passingStyle", v)} />
          <Instruction label="Tempo" value={career.tactics.instructions.tempo} options={[...TEMPOS]} onChange={(v) => changeInstruction("tempo", v)} />
          <Instruction label="Pressing" value={career.tactics.instructions.pressing} options={[...PRESSING_LEVELS]} onChange={(v) => changeInstruction("pressing", v)} />
          <Instruction label="Defensive line" value={career.tactics.instructions.defensiveLine} options={[...DEFENSIVE_LINES]} onChange={(v) => changeInstruction("defensiveLine", v)} />
          <Instruction label="Width" value={career.tactics.instructions.width} options={[...WIDTHS]} onChange={(v) => changeInstruction("width", v)} />
        </div>
      </div>

      <div className="tactics-layout">
        <div className="panel">
          <div className="panel-title">Pitch</div>
          <div className="tactics-pitch">
            <PitchBackground />
            {formation.slots.map((slot, i) => {
              const playerId = lineup[i];
              const name = playerId != null ? shortName(getPlayerCurrent(career, playerId).name) : "—";
              return (
                <div
                  key={i}
                  className={`slot ${dragId != null ? "drop-target" : ""}`}
                  draggable
                  onDragStart={(e) => dragStart(e, playerId)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => dropOnSlot(i)}
                  onDragEnd={() => setDragId(null)}
                  style={{ left: `${slot.y}%`, top: `${100 - slot.x}%` }}
                  title={getRole(slot.roleId).name}
                >
                  <div className="slot-role">{getRole(slot.roleId).name}</div>
                  <div className="slot-name">{name}</div>
                </div>
              );
            })}
          </div>
          <div className="bench-row">
            {bench.map((playerId, i) => {
              const name = playerId != null ? shortName(getPlayerCurrent(career, playerId).name) : "—";
              return (
                <div
                  key={i}
                  className={`bench-slot ${dragId != null ? "drop-target" : ""}`}
                  draggable
                  onDragStart={(e) => dragStart(e, playerId)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => dropOnBench(i)}
                  onDragEnd={() => setDragId(null)}
                >
                  <div className="slot-name">{name}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">Squad</div>
          <div className="player-list">
            {squadPlayers.map(({ id, p }) => {
              const inXi = lineup.includes(id);
              const inBench = bench.includes(id);
              return (
                <div key={id} className="player-row" draggable onDragStart={(e) => dragStart(e, id)} onDragEnd={() => setDragId(null)}>
                  <span className="pos">{p.position}</span>
                  <span className="name">{p.name}</span>
                  <AbilityStars ca={p.ca} pa={p.pa} />
                  <span className="marker">{inXi ? "XI" : inBench ? "Bench" : ""}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
