import { getPlayerCurrent, setTactics } from "../game/career";
import { FORMATIONS, getFormation } from "../game/formations";
import { DEFENSIVE_LINES, MENTALITIES, PASSING_STYLES, PRESSING_LEVELS, TEMPOS, WIDTHS } from "../game/instructions";
import { getRole } from "../game/roles";
import { assignPlayer, pickLineup } from "../game/teamSelection";
import type { CareerState, TeamInstructions } from "../game/types";

interface Props {
  career: CareerState;
  apply: (next: CareerState) => void;
}

function shortName(name: string): string {
  const parts = name.split(" ");
  return parts.length > 1 ? parts[parts.length - 1] : name;
}

export function TacticsView({ career, apply }: Props) {
  const clubId = career.userClubId;
  const squad = career.squads[clubId] ?? [];
  const caOf = (id: number) => getPlayerCurrent(career, id).ca;

  const squadPlayers = [...squad]
    .map((id) => ({ id, p: getPlayerCurrent(career, id) }))
    .sort((a, b) => b.p.ca - a.p.ca);

  const formation = getFormation(career.tactics.formationId);
  const nameOf = (id: number) => {
    const p = getPlayerCurrent(career, id);
    return `${p.name} (${p.ca})`;
  };

  const changeFormation = (fid: string) => {
    const { lineup, bench } = pickLineup(squad, getFormation(fid), caOf);
    apply(setTactics(career, { formationId: fid, instructions: career.tactics.instructions, lineup, bench }));
  };

  const changeInstruction = (key: keyof TeamInstructions, value: string) => {
    const instructions = { ...career.tactics.instructions, [key]: value } as TeamInstructions;
    apply(setTactics(career, { ...career.tactics, instructions }));
  };

  const changeSlot = (area: "lineup" | "bench", index: number, playerId: number) => {
    apply(setTactics(career, assignPlayer(career.tactics, area, index, playerId)));
  };

  const autoPick = () => {
    const { lineup, bench } = pickLineup(squad, getFormation(career.tactics.formationId), caOf);
    apply(setTactics(career, { ...career.tactics, lineup, bench }));
  };

  const playerOptions = squadPlayers.map((x) => ({ id: x.id, label: nameOf(x.id) }));

  const Select = ({ value, onChange }: { value: number; onChange: (id: number) => void }) => (
    <select value={String(value)} onChange={(e) => onChange(Number(e.target.value))} style={{ minWidth: 200 }}>
      {playerOptions.map((o) => (
        <option key={o.id} value={o.id}>{o.label}</option>
      ))}
    </select>
  );

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
            <button
              key={f.id}
              className={`btn small ${f.id === formation.id ? "primary" : ""}`}
              onClick={() => changeFormation(f.id)}
            >
              {f.name}
            </button>
          ))}
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

      <div className="grid cols-2">
        <div className="panel">
          <div className="section-head">
            <div className="panel-title" style={{ margin: 0 }}>Starting XI</div>
            <button className="btn small" onClick={autoPick}>Auto-pick</button>
          </div>
          <table className="table">
            <tbody>
              {formation.slots.map((slot, i) => {
                const playerId = career.tactics.lineup[i];
                return (
                  <tr key={i}>
                    <td className="dim" style={{ width: 120 }}>{getRole(slot.roleId).name}</td>
                    <td><Select value={playerId} onChange={(id) => changeSlot("lineup", i, id)} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="panel">
          <div className="panel-title">Bench</div>
          <table className="table">
            <tbody>
              {career.tactics.bench.map((playerId, i) => (
                <tr key={i}>
                  <td className="dim" style={{ width: 120 }}>SUB {i + 1}</td>
                  <td><Select value={playerId} onChange={(id) => changeSlot("bench", i, id)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">Shape</div>
        <div style={{ position: "relative", width: 360, height: 500, background: "#1e5a2a", borderRadius: 6, border: "2px solid #fff3", margin: "0 auto" }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: "50%", borderTop: "1px solid #ffffff22" }} />
          <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, borderLeft: "1px solid #ffffff22" }} />
          {formation.slots.map((slot, i) => {
            const playerId = career.tactics.lineup[i];
            const name = playerId != null ? shortName(getPlayerCurrent(career, playerId).name) : "—";
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: `${slot.y}%`,
                  top: `${100 - slot.x}%`,
                  transform: "translate(-50%, -50%)",
                  background: "#123",
                  color: "#fff",
                  border: "1px solid #ffffff55",
                  borderRadius: 4,
                  padding: "2px 6px",
                  fontSize: 11,
                  whiteSpace: "nowrap",
                }}
              >
                {name}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
