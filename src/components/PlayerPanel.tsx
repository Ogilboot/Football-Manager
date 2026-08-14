import { formatMoney, formatWage } from "../game/format";
import type { Player } from "../game/types";
import { CategoryBadge } from "./ui";

const GROUPS: { title: string; keys: (keyof Player["attrs"])[] }[] = [
  {
    title: "Technical",
    keys: ["crossing", "finishing", "heading", "shortPassing", "volleys", "dribbling", "curve", "freeKick", "longPassing", "ballControl", "longShots", "penalties"],
  },
  {
    title: "Mental",
    keys: ["aggression", "interceptions", "positioning", "vision", "composure", "marking"],
  },
  {
    title: "Physical",
    keys: ["acceleration", "sprintSpeed", "agility", "reactions", "balance", "shotPower", "jumping", "stamina", "strength"],
  },
  {
    title: "Goalkeeping",
    keys: ["gkDiving", "gkHandling", "gkKicking", "gkPositioning", "gkReflexes"],
  },
];

function AttrBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="attr-row">
      <span className="label">{label}</span>
      <span className="bar"><span className="fill" style={{ width: `${Math.max(2, value)}%` }} /></span>
      <span className="num">{value}</span>
    </div>
  );
}

export function PlayerPanel({ player }: { player: Player }) {
  const isGK = player.category === "GK";
  const groups = isGK ? GROUPS : GROUPS.filter((g) => g.title !== "Goalkeeping");
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

      {groups.map((g) => (
        <div key={g.title} style={{ marginBottom: 12 }}>
          <div className="panel-title" style={{ marginBottom: 6 }}>{g.title}</div>
          {g.keys.map((k) => <AttrBar key={k} label={k} value={player.attrs[k]} />)}
        </div>
      ))}
    </div>
  );
}
