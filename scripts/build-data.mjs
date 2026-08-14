import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SRC_CSV = "C:/Users/callu/AppData/Local/Temp/opencode/fc25_male_players.csv";

// Which leagues to include (easy to extend).
const LEAGUE_COUNTRY = {
  "Premier League": "England",
  "EFL Championship": "England",
  "LALIGA EA SPORTS": "Spain",
  "Serie A Enilive": "Italy",
  "Bundesliga": "Germany",
  "Ligue 1 McDonald's": "France",
};

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false;
      } else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const rows = parseCSV(fs.readFileSync(SRC_CSV, "utf8"));
const header = rows[0];
const col = (name) => header.indexOf(name);
const num = (v) => { const n = parseInt(String(v).replace(/[^0-9]/g, ""), 10); return Number.isFinite(n) ? n : null; };

const C = {
  name: col("Name"),
  ovr: col("OVR"),
  position: col("Position"),
  altPositions: col("Alternative positions"),
  height: col("Height"),
  weight: col("Weight"),
  age: col("Age"),
  nation: col("Nation"),
  weakFoot: col("Weak foot"),
  skillMoves: col("Skill moves"),
  foot: col("Preferred foot"),
  team: col("Team"),
  league: col("League"),
  crossing: col("Crossing"),
  finishing: col("Finishing"),
  heading: col("Heading Accuracy"),
  shortPassing: col("Short Passing"),
  volleys: col("Volleys"),
  dribbling: col("Dribbling"),
  curve: col("Curve"),
  freeKick: col("Free Kick Accuracy"),
  longPassing: col("Long Passing"),
  ballControl: col("Ball Control"),
  acceleration: col("Acceleration"),
  sprintSpeed: col("Sprint Speed"),
  agility: col("Agility"),
  reactions: col("Reactions"),
  balance: col("Balance"),
  shotPower: col("Shot Power"),
  jumping: col("Jumping"),
  stamina: col("Stamina"),
  strength: col("Strength"),
  longShots: col("Long Shots"),
  aggression: col("Aggression"),
  interceptions: col("Interceptions"),
  positioning: col("Positioning"),
  vision: col("Vision"),
  penalties: col("Penalties"),
  marking: col("Def Awareness"),
  standingTackle: col("Standing Tackle"),
  slidingTackle: col("Sliding Tackle"),
  composure: col("Composure"),
  gkDiving: col("GK Diving"),
  gkHandling: col("GK Handling"),
  gkKicking: col("GK Kicking"),
  gkPositioning: col("GK Positioning"),
  gkReflexes: col("GK Reflexes"),
};

function cm(s) { return num(s); } // "182cm / 6'0\"" -> 182
function kg(s) { return num(s); } // "75kg / 165lb" -> 75
function firstWord(s) { return String(s).split(",")[0].trim().toUpperCase(); }

function category(pos) {
  if (pos === "GK") return "GK";
  if (["CB", "RB", "LB", "RWB", "LWB"].includes(pos)) return "DF";
  if (["CDM", "CM", "CAM", "RM", "LM"].includes(pos)) return "MF";
  if (["ST", "CF", "RW", "LW"].includes(pos)) return "FW";
  return "MF";
}

function shortCode(name) {
  const words = name.replace(/[^A-Za-z ]/g, "").split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.map((w) => w[0]).join("").slice(0, 3).toUpperCase();
}

function potential(ca, age) {
  const boost = age <= 19 ? 10 : age <= 21 ? 7 : age <= 23 ? 5 : age <= 25 ? 3 : age <= 27 ? 1 : 0;
  return Math.min(99, ca + boost);
}

const POS_FACTOR = { GK: 0.85, DF: 0.9, MF: 1.0, FW: 1.15 };
function value(ca, age, cat) {
  const ageFactor = age <= 21 ? 1.2 : age <= 25 ? 1.05 : age <= 28 ? 0.85 : age <= 31 ? 0.5 : age <= 34 ? 0.25 : 0.1;
  const rating = Math.pow(ca / 100, 6);
  return Math.round((rating * 250_000_000 * (POS_FACTOR[cat] ?? 1) * ageFactor) / 10000) * 10000;
}
function wage(ca) {
  return Math.max(500, Math.round(Math.pow(ca / 100, 4) * 400_000 / 500) * 500);
}

// ---- Parse players in selected leagues -----------------------------------
const teams = new Map(); // teamName -> { id, league, players: [] }
const players = {};
let playerSeq = 0;
let skipped = 0;

for (let r = 1; r < rows.length; r++) {
  const row = rows[r];
  const league = row[C.league];
  const teamName = row[C.team];
  const ca = num(row[C.ovr]);
  if (!(league in LEAGUE_COUNTRY) || !teamName || ca == null) { skipped++; continue; }

  if (!teams.has(teamName)) {
    teams.set(teamName, { id: teams.size, name: teamName, league, country: LEAGUE_COUNTRY[league], players: [] });
  }
  const team = teams.get(teamName);
  const playerId = playerSeq++;
  team.players.push(playerId);

  const age = num(row[C.age]) ?? 0;
  const pos = firstWord(row[C.position]);
  const cat = category(pos);
  const attrs = (keys) => {
    const o = {};
    for (const [k, i] of Object.entries(keys)) o[k] = num(row[i]) ?? 0;
    return o;
  };

  players[playerId] = {
    name: row[C.name],
    age,
    nation: row[C.nation] || null,
    position: pos,
    altPositions: String(row[C.altPositions] || "").split(",").map((s) => s.trim()).filter(Boolean),
    category: cat,
    height: cm(row[C.height]),
    weight: kg(row[C.weight]),
    foot: row[C.foot] === "Left" ? "left" : row[C.foot] === "Right" ? "right" : null,
    weakFoot: num(row[C.weakFoot]) ?? 3,
    skillMoves: num(row[C.skillMoves]) ?? 2,
    ca,
    pa: potential(ca, age),
    value: value(ca, age, cat),
    wage: wage(ca),
    attrs: attrs({
      crossing: C.crossing, finishing: C.finishing, heading: C.heading,
      shortPassing: C.shortPassing, volleys: C.volleys, dribbling: C.dribbling,
      curve: C.curve, freeKick: C.freeKick, longPassing: C.longPassing,
      ballControl: C.ballControl, acceleration: C.acceleration, sprintSpeed: C.sprintSpeed,
      agility: C.agility, reactions: C.reactions, balance: C.balance, shotPower: C.shotPower,
      jumping: C.jumping, stamina: C.stamina, strength: C.strength, longShots: C.longShots,
      aggression: C.aggression, interceptions: C.interceptions, positioning: C.positioning,
      vision: C.vision, penalties: C.penalties, marking: C.marking, standingTackle: C.standingTackle,
      slidingTackle: C.slidingTackle, composure: C.composure, gkDiving: C.gkDiving,
      gkHandling: C.gkHandling, gkKicking: C.gkKicking, gkPositioning: C.gkPositioning, gkReflexes: C.gkReflexes,
    }),
  };
}

const teamList = [...teams.values()]
  .sort((a, b) => a.name.localeCompare(b.name))
  .map((t) => ({ id: t.id, name: t.name, shortName: shortCode(t.name), league: t.league, country: t.country }));

const leagues = Object.entries(LEAGUE_COUNTRY).map(([name, country]) => ({
  name,
  country,
  teams: teamList.filter((t) => t.league === name).map((t) => t.id),
}));

const squads = {};
for (const t of teams.values()) squads[t.id] = t.players;

const out = {
  meta: {
    game: "EA Sports FC 25",
    season: "2025/2026",
    source: "soFIFA / EA Sports FC 25 player database (mirrored from nyagami's Kaggle FC25 dataset)",
    generatedAt: new Date().toISOString(),
  },
  leagues,
  teams: teamList,
  squads,
  players,
};

const dest = path.join(ROOT, "src", "data", "gameData.json");
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(out));

console.log(`Leagues: ${leagues.length}`);
console.log(`Teams: ${teamList.length}`);
console.log(`Players: ${Object.keys(players).length} (skipped ${skipped} out of league / missing)`);
console.log(`JSON: ${(fs.statSync(dest).size / 1024).toFixed(0)} KB`);
for (const l of leagues) {
  const n = l.teams.reduce((sum, id) => sum + (squads[id]?.length ?? 0), 0);
  console.log(`  ${l.name} (${l.country}): ${l.teams.length} teams, ${n} players`);
}
