import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const d = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "src", "data", "gameData.json"), "utf8"));

const players = Object.entries(d.players);
console.log("Top 15 by CA:");
[...players].sort((a, b) => b[1].ca - a[1].ca).slice(0, 15).forEach(([, p]) =>
  console.log(`  ${p.ca} ${p.position} ${p.name} (age ${p.age}, ${p.nation})`),
);

const byTeam = (name) => {
  const t = d.teams.find((x) => x.name === name);
  if (!t) return console.log("  team not found:", name);
  const squad = (d.squads[t.id] || []).map((id) => d.players[id]).sort((a, b) => b.ca - a.ca);
  console.log(`\n${name} squad (${squad.length} players):`);
  squad.slice(0, 8).forEach((p) => console.log(`  ${p.ca} ${p.position} ${p.name} £${(p.value / 1e6).toFixed(1)}m £${p.wage.toLocaleString()}/wk`));
};
byTeam("Manchester City");
byTeam("Arsenal");
byTeam("Real Madrid");

console.log("\nLeagues:", d.leagues.map((l) => `${l.name}(${l.teams.length})`).join(", "));
