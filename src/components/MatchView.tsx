import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "../game/data";
import type { MatchEvent, MatchLog, PositionFrame } from "../game/matchTypes";

interface Props {
  log: MatchLog;
  userClubId: number;
  onClose: () => void;
}

const H = 70;
const sy = (y: number) => y * 0.7;

const SPEEDS = [0.5, 1, 2];

function pname(id: number): string {
  return db.players.get(id)?.name ?? "?";
}
function tname(id: number): string {
  return db.teamById.get(id)?.name ?? "?";
}

interface Waypoint {
  minute: number;
  x: number;
  y: number;
}

function shotImpact(e: Extract<MatchEvent, { type: "shot" }>, homeId: number): { x: number; y: number } {
  const dir = e.team === homeId ? 1 : -1;
  switch (e.outcome) {
    case "goal":
      return { x: dir === 1 ? 100 : 0, y: 50 };
    case "saved":
      return { x: dir === 1 ? 94 : 6, y: e.from.y };
    case "blocked":
      return { x: e.from.x + dir * 8, y: e.from.y + 4 };
    default:
      return { x: dir === 1 ? 101 : -1, y: e.from.y > 50 ? 66 : 34 };
  }
}

function buildPath(log: MatchLog, homeId: number): Waypoint[] {
  const raw: { m: number; x: number; y: number }[] = [{ m: 0, x: 50, y: 50 }];
  const events = log.events;
  for (let idx = 0; idx < events.length; idx++) {
    const e = events[idx];
    switch (e.type) {
      case "pass":
        raw.push({ m: e.minute, x: e.to.x, y: e.to.y });
        break;
      case "shot": {
        const impact = shotImpact(e, homeId);
        let after = { x: 50, y: 50 };
        for (let j = idx + 1; j < events.length; j++) {
          const n = events[j];
          if (n.minute > e.minute) break;
          if (n.type === "goal") {
            after = { x: 50, y: 50 };
            idx = j;
            break;
          }
          if (n.type === "setPiece") {
            after = { x: n.position.x, y: n.position.y };
            idx = j;
            break;
          }
        }
        raw.push({ m: e.minute, x: e.from.x, y: e.from.y });
        raw.push({ m: e.minute, x: impact.x, y: impact.y });
        raw.push({ m: e.minute, x: after.x, y: after.y });
        break;
      }
      case "goal":
        raw.push({ m: e.minute, x: 50, y: 50 });
        break;
      case "setPiece":
        raw.push({ m: e.minute, x: e.position.x, y: e.position.y });
        break;
      case "tackle":
        raw.push({ m: e.minute, x: e.position.x, y: e.position.y });
        break;
      case "foul":
        raw.push({ m: e.minute, x: e.position.x, y: e.position.y });
        break;
    }
  }

  // Waypoints sharing a minute are spread across the gap to the next distinct
  // minute, so the ball flows continuously instead of bursting then stalling.
  const path: Waypoint[] = [];
  let g = 0;
  while (g < raw.length) {
    const m = raw[g].m;
    let end = g;
    while (end < raw.length && raw[end].m === m) end++;
    const group = raw.slice(g, end);
    const nextM = end < raw.length ? raw[end].m : m + 1;
    const span = Math.max(0.6, nextM - m);
    for (let k = 0; k < group.length; k++) {
      path.push({ minute: m + (span * k) / group.length, x: group[k].x, y: group[k].y });
    }
    g = end;
  }
  return path;
}

function ballAt(path: Waypoint[], t: number): { x: number; y: number } {
  if (!path.length) return { x: 50, y: 50 };
  if (t <= path[0].minute) return path[0];
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    if (t >= a.minute && t <= b.minute) {
      if (b.minute <= a.minute) return b;
      const f = (t - a.minute) / (b.minute - a.minute);
      const e = f * f * (3 - 2 * f);
      return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e };
    }
  }
  return path[path.length - 1];
}

function describe(e: MatchEvent): string | null {
  switch (e.type) {
    case "goal":
      return `GOAL — ${pname(e.playerId)} (${e.minute}')`;
    case "shot":
      if (e.outcome === "saved") return `${pname(e.playerId)} — shot saved`;
      if (e.outcome === "blocked") return `${pname(e.playerId)} — shot blocked`;
      return `${pname(e.playerId)} — shot off target`;
    case "card":
      return e.card === "red" ? `${pname(e.playerId)} — sent off` : `${pname(e.playerId)} — booked`;
    case "injury":
      return `${pname(e.playerId)} — injured (${e.severity})`;
    case "substitution":
      return `${pname(e.onPlayerId)} replaces ${pname(e.offPlayerId)}`;
    case "offside":
      return `${pname(e.playerId)} — offside`;
    case "setPiece":
      return e.kind === "corner" ? `Corner to ${tname(e.team)}` : null;
    default:
      return null;
  }
}

function parseFrame(roster: number[], f: PositionFrame): Map<number, { x: number; y: number }> {
  const m = new Map<number, { x: number; y: number }>();
  for (let i = 0; i < roster.length; i++) {
    const x = f.p[i * 2];
    const y = f.p[i * 2 + 1];
    if (x >= 0 && y >= 0) m.set(roster[i], { x, y });
  }
  return m;
}

function positionsAt(roster: number[], frames: PositionFrame[], t: number): { id: number; x: number; y: number }[] {
  if (!frames.length) return [];
  let prev = frames[0];
  let next = frames[0];
  for (const f of frames) {
    if (f.minute <= t) prev = f;
    else {
      next = f;
      break;
    }
  }
  const pm = parseFrame(roster, prev);
  const nm = next === prev ? null : parseFrame(roster, next);
  const frac = next.minute > prev.minute ? (t - prev.minute) / (next.minute - prev.minute) : 0;
  const out: { id: number; x: number; y: number }[] = [];
  for (const [id, pp] of pm) {
    const np = nm ? nm.get(id) : null;
    const x = np ? pp.x + (np.x - pp.x) * frac : pp.x;
    const y = np ? pp.y + (np.y - pp.y) * frac : pp.y;
    out.push({ id, x, y });
  }
  return out;
}

function Pitch() {
  return (
    <svg viewBox={`0 0 100 ${H}`} className="pitch-svg" preserveAspectRatio="xMidYMid meet">
      {Array.from({ length: 10 }, (_, i) => (
        <rect key={i} x={i * 10} y={0} width={10} height={H} fill={i % 2 ? "#1c5e34" : "#216b3b"} />
      ))}
      <g stroke="rgba(255,255,255,0.7)" fill="none" strokeWidth="0.3">
        <rect x="1.5" y="1.5" width="97" height={H - 3} />
        <line x1="50" y1="1.5" x2="50" y2={H - 1.5} />
        <circle cx="50" cy={H / 2} r="8.5" />
        <circle cx="50" cy={H / 2} r="0.5" fill="rgba(255,255,255,0.7)" />
        <rect x="1.5" y={H / 2 - 20.75} width="15.7" height="41.5" />
        <rect x="82.8" y={H / 2 - 20.75} width="15.7" height="41.5" />
        <rect x="1.5" y={H / 2 - 9.4} width="5.2" height="18.8" />
        <rect x="93.3" y={H / 2 - 9.4} width="5.2" height="18.8" />
        <circle cx="10.5" cy={H / 2} r="0.35" fill="rgba(255,255,255,0.7)" />
        <circle cx="89.5" cy={H / 2} r="0.35" fill="rgba(255,255,255,0.7)" />
      </g>
      <g stroke="rgba(255,255,255,0.9)" strokeWidth="0.6" fill="none">
        <line x1="0" y1={H / 2 - 3.8} x2="0" y2={H / 2 + 3.8} />
        <line x1="100" y1={H / 2 - 3.8} x2="100" y2={H / 2 + 3.8} />
      </g>
    </svg>
  );
}

export function MatchView({ log, userClubId, onClose }: Props) {
  const homeId = log.context.home.teamId;
  const awayId = log.context.away.teamId;
  const userIsHome = homeId === userClubId;

  const [clock, setClock] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const clockRef = useRef(0);

  const path = useMemo(() => buildPath(log, homeId), [log, homeId]);
  const notable = useMemo(() => log.events.filter((e) => describe(e) != null), [log]);

  const live = useMemo(() => {
    let h = 0;
    let a = 0;
    for (const e of log.events) {
      if (e.minute > clock) break;
      if (e.type === "goal") {
        if (e.team === homeId) h++;
        else a++;
      }
    }
    return { home: h, away: a };
  }, [log, homeId, clock]);

  const goalFlash = useMemo(() => {
    let last = -1;
    for (const e of log.events) {
      if (e.type === "goal" && e.minute <= clock) last = e.minute;
    }
    return last >= 0 && clock - last < 2.5;
  }, [log, clock]);

  useEffect(() => {
    let raf = 0;
    let last: number | null = null;
    const tick = (ts: number) => {
      if (last == null) last = ts;
      const dt = (ts - last) / 1000;
      last = ts;
      if (playing) {
        const next = Math.min(90, clockRef.current + dt * speed);
        clockRef.current = next;
        setClock(next);
        if (next >= 90) setPlaying(false);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed]);

  const ball = ballAt(path, clock);
  const positions = positionsAt(log.roster, log.frames, clock);
  const homeIds = useMemo(() => new Set([...log.context.home.lineup.map((s) => s.playerId), ...log.context.home.bench]), [log]);
  const homePlayers = positions.filter((p) => homeIds.has(p.id));
  const awayPlayers = positions.filter((p) => !homeIds.has(p.id));

  let nearest = -1;
  let nearestD = Infinity;
  for (const p of positions) {
    const d = (ball.x - p.x) * (ball.x - p.x) + (ball.y - p.y) * (ball.y - p.y);
    if (d < nearestD) {
      nearestD = d;
      nearest = p.id;
    }
  }

  const recent = notable.filter((e) => e.minute <= clock).slice(-3);

  const toggle = () => setPlaying((p) => !p);
  const skip = () => {
    clockRef.current = 90;
    setClock(90);
    setPlaying(false);
  };

  const color = (isHome: boolean) => {
    if (isHome === userIsHome) return "#2fbf71";
    return "#e5533d";
  };

  const renderTeam = (players: { id: number; x: number; y: number }[], isHome: boolean) =>
    players.map((p) => {
      const isUser = isHome === userIsHome;
      const isNearest = p.id === nearest;
      return (
        <circle
          key={p.id}
          cx={p.x}
          cy={sy(p.y)}
          r={isNearest ? 1.5 : 1.2}
          fill={color(isHome)}
          stroke={isNearest ? "#ffffff" : isUser ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.4)"}
          strokeWidth={isNearest ? 0.32 : 0.18}
        />
      );
    });

  return (
    <div className="match-view">
      <div className="mv-top">
        <div className="mv-score">
          <span style={{ color: color(true) }}>{tname(homeId)}{userIsHome ? " (You)" : ""}</span>
          <b>{live.home}–{live.away}</b>
          <span style={{ color: color(false) }}>{tname(awayId)}{!userIsHome ? " (You)" : ""}</span>
        </div>
        <div className="mv-clock">
          {clock < 45 ? `${Math.floor(clock)}'` : clock >= 90 ? "FT" : `${Math.floor(clock)}'`}
        </div>
        <div className="mv-controls">
          <button className="btn small" onClick={toggle}>{playing ? "Pause" : "Play"}</button>
          {SPEEDS.map((s) => (
            <button key={s} className={`btn small ${s === speed ? "primary" : ""}`} onClick={() => setSpeed(s)}>{s}×</button>
          ))}
          <button className="btn small" onClick={skip}>Skip</button>
          <button className="btn small primary" onClick={onClose}>{clock >= 90 ? "Continue" : "Close"}</button>
        </div>
      </div>

      <div className="pitch-wrap">
        <div className="pitch-stage">
          <Pitch />
          <svg viewBox={`0 0 100 ${H}`} className="pitch-overlay" preserveAspectRatio="xMidYMid meet">
            {renderTeam(homePlayers, true)}
            {renderTeam(awayPlayers, false)}
            <circle cx={ball.x} cy={sy(ball.y)} r="0.85" fill="#fff" stroke="#000" strokeWidth="0.15" />
          </svg>
          {goalFlash && <div className="goal-flash">GOAL</div>}
        </div>
      </div>

      <div className="mv-ticker">
        {recent.map((e, i) => (
          <div key={i} className={`mv-line ${i === recent.length - 1 ? "current" : "dim"}`}>
            <span className="mv-min">{e.minute}&apos;</span> {describe(e)}
          </div>
        ))}
        {recent.length === 0 && <div className="mv-line dim">Kick-off</div>}
      </div>
    </div>
  );
}
