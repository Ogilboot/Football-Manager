import { formatMoney, formatWage } from "../game/format";
import type { Player, PlayerAttrs, PlayerState } from "../game/types";
import { CategoryBadge, RatingDots } from "./ui";

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

function AttrBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="attr-row">
      <span className="label">{label}</span>
      <span className="bar"><span className="fill" style={{ width: `${Math.max(5, value * 5)}%` }} /></span>
      <span className="num">{value}</span>
    </div>
  );
}

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
  if (state.injured || state.injuryDaysLeft > 0) {
    return <span className="badge-flag injured">Injured · {state.injuryDaysLeft}d</span>;
  }
  if (state.suspended > 0) {
    return <span className="badge-flag suspended">Suspended · {state.suspended} match</span>;
  }
  return null;
}

const PERSONALITY_LABELS: [keyof Player["personality"], string][] = [
  ["consistency", "Consistency"],
  ["ambition", "Ambition"],
  ["professionalism", "Professionalism"],
  ["determination", "Determination"],
  ["pressure", "Pressure"],
  ["bigMatches", "Big Matches"],
  ["injuryProneness", "Injury Proneness"],
  ["adaptability", "Adaptability"],
];

export function PlayerPanel({ player, state, onSetTraining }: { player: Player; state?: PlayerState; onSetTraining?: (focus: keyof PlayerAttrs | null) => void }) {
  const isGK = player.category === "GK";
  const groups = isGK ? GROUPS : GROUPS.filter((g) => g.title !== "Goalkeeping");
  const trainable = TRAINABLE.filter(([k]) =>
    isGK ? GK_TRAIN_KEYS.has(k) || ["acceleration", "stamina", "strength"].includes(k) : !GK_TRAIN_KEYS.has(k),
  );
  return (
    <div>
      <div className="section-head" style={{ marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>
            {player.name} <CategoryBadge cat={player.category} />
          </div>
          <div className="muted small">
            {player.nation ?? ""} · Age {player.age} · {player.position}
            {player.altPositions.length ? ` (alt: ${player.altPositions.join(", ")})` : ""}
          </div>
        </div>
        {state && <StatusTag state={state} />}
      </div>

      <div className="grid cols-3" style={{ marginBottom: 16 }}>
        <div className="kpi"><div className="stat"><span className="k">Value</span><span className="v">{formatMoney(player.value)}</span></div></div>
        <div className="kpi"><div className="stat"><span className="k">Wage</span><span className="v" style={{ fontSize: 16 }}>{formatWage(player.wage)}</span></div></div>
        <div className="kpi"><div className="stat"><span className="k">Height / Weight</span><span className="v" style={{ fontSize: 16 }}>{player.height ? `${player.height} cm` : "—"} · {player.weight ? `${player.weight} kg` : "—"}</span></div></div>
      </div>

      <div className="grid cols-2" style={{ marginBottom: 16 }}>
        <div className="kpi"><div className="stat"><span className="k">Current ability</span><span className="v">{player.ca}</span></div></div>
        <div className="kpi"><div className="stat"><span className="k">Potential</span><span className="v">{player.pa}</span></div></div>
        <div className="kpi"><div className="stat"><span className="k">Preferred foot</span><span className="v" style={{ fontSize: 16, textTransform: "capitalize" }}>{player.foot ?? "—"}</span></div></div>
        <div className="kpi"><div className="stat"><span className="k">Weak foot / Skill moves</span><span className="v" style={{ fontSize: 16 }}>{player.weakFoot}★ / {player.skillMoves}★</span></div></div>
      </div>

      {state && onSetTraining && (
        <div style={{ marginBottom: 16 }}>
          <div className="panel-title" style={{ marginBottom: 6 }}>Training focus</div>
          <select value={state.training ?? ""} onChange={(e) => onSetTraining((e.target.value || null) as keyof PlayerAttrs | null)}>
            <option value="">Balanced</option>
            {trainable.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
          <div className="small muted" style={{ marginTop: 4 }}>Focused attributes grow faster at the end of the season.</div>
        </div>
      )}

      {state && (
        <div style={{ marginBottom: 16 }}>
          <div className="panel-title" style={{ marginBottom: 6 }}>Match Fitness</div>
          <PctBar label="Condition" value={state.condition} />
          <PctBar label="Match sharpness" value={state.matchSharpness} />
          <PctBar label="Fitness" value={state.fitness} />
          <AttrBar label="Morale" value={state.morale} />
          <div className="small muted" style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
            Form: <RatingDots form={state.form} />
            {state.yellowCards > 0 && <> · {state.yellowCards} yellow cards this season</>}
          </div>
        </div>
      )}

      {groups.map((g) => (
        <div key={g.title} style={{ marginBottom: 12 }}>
          <div className="panel-title" style={{ marginBottom: 6 }}>{g.title}</div>
          {g.keys.map((k) => <AttrBar key={k} label={k} value={player.attrs[k]} />)}
        </div>
      ))}

      <div style={{ marginBottom: 12 }}>
        <div className="panel-title" style={{ marginBottom: 6 }}>Personality</div>
        {PERSONALITY_LABELS.map(([k, label]) => <AttrBar key={k} label={label} value={player.personality[k]} />)}
      </div>
    </div>
  );
}
