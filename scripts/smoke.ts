import { db } from "../src/game/data";
import {
  advanceWeek,
  askingPriceFor,
  contractDemand,
  leagueStandings,
  makeTransferBid,
  newCareer,
  playerClub,
  sellToClub,
  startNextSeason,
  transferOffers,
  userPosition,
} from "../src/game/career";

const city = db.teams.find((t) => t.name === "Manchester City");
if (!city) throw new Error("no city");

const career = newCareer(city.id, "test");
console.log("New career:", city.name, "budget", career.balance, "fixtures", career.fixtures.length, "stages", career.totalStages);

// Simulate a full season
let state = career;
for (let i = 0; i < career.totalStages; i++) {
  state = advanceWeek(state).state;
}

console.log("Season over:", state.seasonOver, "| user pos:", userPosition(state));
const standings = leagueStandings(state);
console.log("Top 5:");
standings.slice(0, 5).forEach((r, i) => {
  const t = db.teamById.get(r.teamId)!;
  console.log(`  ${i + 1}. ${t.name} ${r.points}pts (${r.won}-${r.drawn}-${r.lost})`);
});

// Test a transfer: find a high-CA player not at City and buy them
const target = [...db.players.entries()]
  .map(([id, p]) => ({ id, ca: p.ca }))
  .filter((x) => playerClub(state, x.id) !== city.id)
  .sort((a, b) => b.ca - a.ca)[0];
console.log("\nBuy test: player", db.players.get(target.id)!.name, "CA", target.ca);
const before = state.balance;
const ask = askingPriceFor(state, target.id);
const demand = contractDemand(state, target.id, 3);
const bought = makeTransferBid(state, target.id, ask, demand, 3);
console.log("  ok:", bought.ok, "| msg:", bought.message);
if (bought.ok) {
  console.log("  balance before/after:", before, "->", bought.state.balance);
  console.log("  now at City:", playerClub(bought.state, target.id) === city.id);
  const offers = transferOffers(bought.state, target.id);
  if (offers.length) {
    const sold = sellToClub(bought.state, target.id, offers[0].clubId, offers[0].fee);
    console.log("Sell to", db.teamById.get(offers[0].clubId)!.name + ":", sold.ok, sold.message);
  } else {
    console.log("Sell back: no interested clubs");
  }
}

// Next season rollover
const next = startNextSeason(state);
console.log("\nNext season year:", next.seasonStartYear, "| stage reset:", next.nextStage, "| fixtures:", next.fixtures.length);
const mbappe = [...db.players.values()].find((p) => p.name.includes("Mbapp"));
if (mbappe) {
  const mid = [...db.players.keys()].find((id) => db.players.get(id)!.name.includes("Mbapp"))!;
  console.log("Mbappé override after rollover:", next.playerOverrides[mid]);
}
