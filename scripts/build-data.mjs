import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SRC_CSV = "C:/Users/callu/AppData/Local/Temp/opencode/fc26_players.csv";

// Top 5 European leagues + their 2nd divisions, keyed by soFIFA league id.
// league_id is reliable; league_name alone mixes countries (e.g. "Bundesliga"
// also contains the Austrian Bundesliga).
const LEAGUES = {
  13: { name: "Premier League", country: "England", level: 1 },
  14: { name: "Championship", country: "England", level: 2 },
  53: { name: "La Liga", country: "Spain", level: 1 },
  54: { name: "La Liga 2", country: "Spain", level: 2 },
  31: { name: "Serie A", country: "Italy", level: 1 },
  32: { name: "Serie B", country: "Italy", level: 2 },
  19: { name: "Bundesliga", country: "Germany", level: 1 },
  20: { name: "2. Bundesliga", country: "Germany", level: 2 },
  16: { name: "Ligue 1", country: "France", level: 1 },
  17: { name: "Ligue 2", country: "France", level: 2 },
};

const MAX_SQUAD = 30; // cap players per club (first team only)

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
const num = (v) => {
  const n = Number(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : null;
};

const C = {
  url: col("player_url"),
  shortName: col("short_name"),
  positions: col("player_positions"),
  clubPosition: col("club_position"),
  overall: col("overall"),
  potential: col("potential"),
  value: col("value_eur"),
  wage: col("wage_eur"),
  age: col("age"),
  height: col("height_cm"),
  weight: col("weight_kg"),
  nation: col("nationality_name"),
  foot: col("preferred_foot"),
  weakFoot: col("weak_foot"),
  skillMoves: col("skill_moves"),
  team: col("club_name"),
  leagueId: col("league_id"),
};

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

const ATTR_MAP = {
  crossing: "attacking_crossing",
  finishing: "attacking_finishing",
  heading: "attacking_heading_accuracy",
  shortPassing: "attacking_short_passing",
  volleys: "attacking_volleys",
  dribbling: "skill_dribbling",
  curve: "skill_curve",
  freeKick: "skill_fk_accuracy",
  longPassing: "skill_long_passing",
  ballControl: "skill_ball_control",
  acceleration: "movement_acceleration",
  sprintSpeed: "movement_sprint_speed",
  agility: "movement_agility",
  reactions: "movement_reactions",
  balance: "movement_balance",
  shotPower: "power_shot_power",
  jumping: "power_jumping",
  stamina: "power_stamina",
  strength: "power_strength",
  longShots: "power_long_shots",
  aggression: "mentality_aggression",
  interceptions: "mentality_interceptions",
  positioning: "mentality_positioning",
  vision: "mentality_vision",
  penalties: "mentality_penalties",
  composure: "mentality_composure",
  marking: "defending_marking_awareness",
  standingTackle: "defending_standing_tackle",
  slidingTackle: "defending_sliding_tackle",
  gkDiving: "goalkeeping_diving",
  gkHandling: "goalkeeping_handling",
  gkKicking: "goalkeeping_kicking",
  gkPositioning: "goalkeeping_positioning",
  gkReflexes: "goalkeeping_reflexes",
};
const attrCols = Object.fromEntries(Object.entries(ATTR_MAP).map(([k, name]) => [k, col(name)]));

// ---- Parse players in selected leagues -----------------------------------
const teams = new Map(); // clubName -> { id, league, players: [] }
const players = {};
let playerSeq = 0;
let skipped = 0;

for (let r = 1; r < rows.length; r++) {
  const row = rows[r];
  const leagueId = num(row[C.leagueId]);
  const teamName = row[C.team];
  const ca = num(row[C.overall]);
  const clubPos = row[C.clubPosition];
  if (!(leagueId in LEAGUES) || !teamName || ca == null || clubPos === "RES") { skipped++; continue; }

  if (!teams.has(teamName)) {
    const league = LEAGUES[leagueId];
    teams.set(teamName, { id: teams.size, name: teamName, league: league.name, country: league.country, players: [] });
  }
  const team = teams.get(teamName);
  const playerId = playerSeq++;
  team.players.push({ playerId, ca });

  const positions = String(row[C.positions] || "").split(",").map((s) => s.trim()).filter(Boolean);
  const pos = positions[0] ?? "CM";
  const pa = num(row[C.potential]) ?? ca;

  const attrs = {};
  for (const [k, i] of Object.entries(attrCols)) attrs[k] = num(row[i]) ?? 0;

  players[playerId] = {
    name: row[C.shortName] || "Unknown",
    age: num(row[C.age]) ?? 0,
    nation: row[C.nation] || null,
    position: pos,
    altPositions: positions.slice(1),
    category: category(pos),
    height: num(row[C.height]),
    weight: num(row[C.weight]),
    foot: row[C.foot] === "Left" ? "left" : row[C.foot] === "Right" ? "right" : null,
    weakFoot: num(row[C.weakFoot]) ?? 3,
    skillMoves: num(row[C.skillMoves]) ?? 2,
    ca,
    pa,
    value: num(row[C.value]) ?? 0,
    wage: num(row[C.wage]) ?? 500,
    attrs,
  };
}

// Cap each squad to the strongest players.
for (const t of teams.values()) {
  t.players = t.players.sort((a, b) => b.ca - a.ca).slice(0, MAX_SQUAD).map((p) => p.playerId);
}

const teamList = [...teams.values()]
  .sort((a, b) => a.name.localeCompare(b.name))
  .map((t) => ({ id: t.id, name: t.name, shortName: shortCode(t.name), league: t.league, country: t.country }));

const leagues = Object.values(LEAGUES).map((l) => ({
  name: l.name,
  country: l.country,
  level: l.level,
  teams: teamList.filter((t) => t.league === l.name).map((t) => t.id),
}));

const squads = {};
for (const t of teams.values()) squads[t.id] = t.players;

const out = {
  meta: {
    game: "EA Sports FC 26",
    season: "2025/2026",
    source: "EA Sports FC 26 player database (soFIFA via ismailoksuz/EAFC26-DataHub)",
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
console.log(`Players: ${Object.keys(players).length} (skipped ${skipped})`);
console.log(`JSON: ${(fs.statSync(dest).size / 1024).toFixed(0)} KB`);
for (const l of leagues) {
  const n = l.teams.reduce((sum, id) => sum + (squads[id]?.length ?? 0), 0);
  console.log(`  ${l.name} (${l.country}): ${l.teams.length} teams, ${n} players`);
}
