import { CAT_ATTRS, moraleLabel } from "../game/career";
import { nationFlag } from "../game/nations";
import { formatMoney, formatWage } from "../game/format";
import type { Category, Contract, Personality, Player, PlayerAttrs, PlayerState } from "../game/types";
import { AbilityStars, CategoryBadge, RatingDots } from "./ui";

const TRAINABLE: [keyof PlayerAttrs, string][] = [
  ["finishing", "Finishing"],
  ["offTheBall", "Off The Ball"],
  ["composure", "Composure"],
  ["passing", "Passing"],
  ["vision", "Vision"],
  ["firstTouch", "First Touch"],
  ["technique", "Technique"],
  ["dribbling", "Dribbling"],
  ["crossing", "Crossing"],
  ["heading", "Heading"],
  ["tackling", "Tackling"],
  ["marking", "Marking"],
  ["acceleration", "Acceleration"],
  ["pace", "Pace"],
  ["stamina", "Stamina"],
  ["strength", "Strength"],
  ["reflexes", "Reflexes"],
  ["handling", "Handling"],
  ["oneOnOnes", "One On Ones"],
];

const GK_TRAIN_KEYS = new Set<string>(["reflexes", "handling", "oneOnOnes", "command", "aerialReach", "kicking"]);

const GROUPS: { title: string; keys: (keyof Player["attrs"])[] }[] = [
  {
    title: "Technical",
    keys: ["corners", "crossing", "dribbling", "finishing", "firstTouch", "freeKicks", "heading", "longShots", "marking", "passing", "penalties", "tackling", "technique"],
  },
  {
    title: "Mental",
    keys: ["aggression", "anticipation", "bravery", "composure", "concentration", "creativity", "decisions", "flair", "offTheBall", "positioning", "teamwork", "vision", "workRate"],
  },
  {
    title: "Physical",
    keys: ["acceleration", "agility", "balance", "jumping", "naturalFitness", "pace", "stamina", "strength"],
  },
  {
    title: "Goalkeeping",
    keys: ["aerialReach", "command", "communication", "handling", "kicking", "oneOnOnes", "reflexes", "throwing"],
  },
];

const POSITION_GROUPS: Record<Category, string[]> = {
  GK: ["GK"],
  DF: ["CB", "LB", "RB", "LWB", "RWB"],
  MF: ["CDM", "CM", "CAM", "LM", "RM"],
  FW: ["ST", "CF", "LW", "RW"],
};

const PERSONALITY_LABELS: [keyof Personality, string][] = [
  ["professionalism", "Professionalism"],
  ["ambition", "Ambition"],
  ["determination", "Determination"],
  ["consistency", "Consistency"],
  ["pressure", "Pressure"],
  ["bigMatches", "Big Matches"],
  ["injuryProneness", "Injury Proneness"],
  ["adaptability", "Adaptability"],
];

function PctBar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="attr-row">
      <span className="label">{label}</span>
      <span className="bar"><span className="fill" style={{ width: `${pct}%` }} /></span>
      <span className="num">{Math.round(pct)}</span>
    </div>
  );
}

function StatusTag({ state }: { state: PlayerState }) {
  if (state.injured || state.injuryDaysLeft > 0) return <span className="badge-flag injured">Injured · {state.injuryDaysLeft}d</span>;
  if (state.suspended > 0) return <span className="badge-flag suspended">Suspended · {state.suspended} match</span>;
  return null;
}

function fmtAttr(k: string): string {
  return k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}

function attrClass(v: number): string {
  if (v >= 16) return "attr-elite";
  if (v >= 13) return "attr-good";
  if (v >= 10) return "attr-avg";
  return "attr-low";
}

function positionFamiliarity(p: Player): { pos: string; level: "Natural" | "Accomplished" | "Competent" }[] {
  const list: { pos: string; level: "Natural" | "Accomplished" | "Competent" }[] = [{ pos: p.position, level: "Natural" }];
  for (const pos of p.altPositions) list.push({ pos, level: "Accomplished" });
  for (const pos of POSITION_GROUPS[p.category] ?? []) {
    if (pos !== p.position && !p.altPositions.includes(pos)) list.push({ pos, level: "Competent" });
  }
  return list;
}

function personalitySummary(p: Personality): string {
  const traits: string[] = [];
  if (p.professionalism >= 15) traits.push("professional");
  else if (p.professionalism <= 6) traits.push("unprofessional");
  if (p.ambition >= 15) traits.push("ambitious");
  if (p.determination >= 15) traits.push("determined");
  else if (p.determination <= 6) traits.push("easy-going");
  if (p.consistency >= 15) traits.push("consistent");
  else if (p.consistency <= 6) traits.push("inconsistent");
  if (p.pressure >= 15) traits.push("composed under pressure");
  if (p.bigMatches >= 15) traits.push("a big-game player");
  if (traits.length === 0) return "A well-balanced, dependable character.";
  return traits.slice(0, 3).join(", ").replace(/^./, (c) => c.toUpperCase()) + ".";
}

export function PlayerPanel({ player, state, onSetTraining, contract, seasonYear, onRenew, happiness, onInteract }: {
  player: Player;
  state?: PlayerState;
  onSetTraining?: (focus: keyof PlayerAttrs | null) => void;
  contract?: Contract;
  seasonYear?: number;
  onRenew?: () => void;
  happiness?: string[];
  onInteract?: (kind: "praise" | "encourage" | "criticize") => void;
}) {
  const isGK = player.category === "GK";
  const groups = isGK ? GROUPS : GROUPS.filter((g) => g.title !== "Goalkeeping");
  const keyAttrs = CAT_ATTRS[player.category] ?? [];
  const positions = positionFamiliarity(player);
  const trainable = TRAINABLE.filter(([k]) =>
    isGK ? GK_TRAIN_KEYS.has(k) || ["acceleration", "stamina", "strength"].includes(k) : !GK_TRAIN_KEYS.has(k),
  );

  return (
    <div>
      <div className="section-head" style={{ marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>
            {player.name} <CategoryBadge cat={player.category} />
          </div>
          <div className="muted small">
            {nationFlag(player.nation)} {player.nation ?? ""} · Age {player.age}
          </div>
        </div>
        {state && <StatusTag state={state} />}
      </div>

      <div className="profile-strip">
        <div className="cell"><div className="k">Height</div><div className="v">{player.height ? `${player.height} cm` : "—"}</div></div>
        <div className="cell"><div className="k">Weight</div><div className="v">{player.weight ? `${player.weight} kg` : "—"}</div></div>
        <div className="cell"><div className="k">Foot</div><div className="v" style={{ textTransform: "capitalize" }}>{player.foot ?? "—"}</div></div>
        <div className="cell"><div className="k">Weak foot</div><div className="v">{player.weakFoot}★</div></div>
        <div className="cell"><div className="k">Value</div><div className="v">{formatMoney(player.value)}</div></div>
        <div className="cell"><div className="k">Wage</div><div className="v" style={{ fontSize: 13 }}>{formatWage(player.wage)}</div></div>
        <div className="cell"><div className="k">Ability</div><div className="v" style={{ fontSize: 13 }}><AbilityStars ca={player.ca} pa={player.pa} /></div></div>
        <div className="cell"><div className="k">Skill moves</div><div className="v">{player.skillMoves}★</div></div>
      </div>

      <div className="panel-title" style={{ marginBottom: 6 }}>Positions</div>
      <div className="pos-list">
        {positions.map((p) => (
          <span key={p.pos} className={`pos-chip ${p.level.toLowerCase()}`}>{p.pos} <small>{p.level}</small></span>
        ))}
      </div>

      {groups.map((g) => (
        <div key={g.title} style={{ marginBottom: 4 }}>
          <div className="panel-title" style={{ marginBottom: 6 }}>{g.title}</div>
          <div className="attr-grid">
            {g.keys.map((k) => (
              <div key={k} className={`attr-cell ${keyAttrs.includes(k) ? "key" : ""}`}>
                <span className="name">{fmtAttr(k)}</span>
                <span className={`val ${attrClass(player.attrs[k])}`}>{player.attrs[k]}</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {state && onSetTraining && (
        <div style={{ marginBottom: 16 }}>
          <div className="panel-title" style={{ marginBottom: 6 }}>Training focus</div>
          <select value={state.training ?? ""} onChange={(e) => onSetTraining((e.target.value || null) as keyof PlayerAttrs | null)}>
            <option value="">Balanced</option>
            {trainable.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </div>
      )}

      {contract && onRenew && (
        <div className="banner" style={{ marginBottom: 16 }}>
          <div className="msg">
            <div className="small muted">Contract</div>
            <div>Expires {contract.expirySeason} · {formatWage(contract.wage)}</div>
            {seasonYear != null && contract.expirySeason <= seasonYear + 1 && <div className="small" style={{ color: "var(--warn)" }}>Expiring soon</div>}
          </div>
          <button className="btn primary" onClick={onRenew}>Renew</button>
        </div>
      )}

      {state && (
        <div style={{ marginBottom: 16 }}>
          <div className="panel-title" style={{ marginBottom: 6 }}>Match Fitness</div>
          <PctBar label="Condition" value={state.condition} />
          <PctBar label="Match sharpness" value={state.matchSharpness} />
          <PctBar label="Fitness" value={state.fitness} />
          <div className="attr-row">
            <span className="label">Morale ({moraleLabel(state.morale)})</span>
            <span className="bar"><span className="fill" style={{ width: `${state.morale * 5}%` }} /></span>
            <span className="num">{state.morale}</span>
          </div>
          <div className="small muted" style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
            Form: <RatingDots form={state.form} />
            {state.yellowCards > 0 && <> · {state.yellowCards} yellow cards this season</>}
          </div>
        </div>
      )}

      {state && happiness && happiness.length > 0 && (
        <div className="panel" style={{ marginBottom: 16, padding: "12px 16px" }}>
          <div className="panel-title" style={{ marginBottom: 6 }}>Happiness</div>
          {happiness.map((r, i) => <div key={i} className="small muted">· {r}</div>)}
          {onInteract && (
            <div className="btn-row" style={{ marginTop: 8 }}>
              <button className="btn small" onClick={() => onInteract("praise")}>Praise</button>
              <button className="btn small" onClick={() => onInteract("encourage")}>Encourage</button>
              <button className="btn small" onClick={() => onInteract("criticize")}>Criticize</button>
            </div>
          )}
        </div>
      )}

      <div style={{ marginBottom: 8 }}>
        <div className="panel-title" style={{ marginBottom: 6 }}>Personality</div>
        <div className="personality-summary">{personalitySummary(player.personality)}</div>
        <div className="trait-grid">
          {PERSONALITY_LABELS.map(([k, label]) => (
            <div key={k} className="attr-cell">
              <span className="name">{label}</span>
              <span className="val attr-avg">{player.personality[k]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
