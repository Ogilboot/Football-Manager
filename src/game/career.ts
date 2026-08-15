import { addGeneratedPlayer, db, GENERATED_ID_START, getPlayer, removeGeneratedPlayers, syncGeneratedPlayers } from "./data";
import { generateFixtures, pairKnockout } from "./fixtures";
import { addDays } from "./format";
import { simulateMatch } from "./matchEngine";
import { generatePersonality } from "./personality";
import { getPlayerState, isAvailable, matchPerformance, resolveWeekStates } from "./playerState";
import { hashString, mulberry32, type Rng } from "./rng";
import { clamp } from "./scales";
import { computeStandings } from "./standings";
import { teamStrength } from "./strength";
import { aiPickTactics, buildMatchSquad } from "./teamSelection";
import type { MatchContext, MatchEvent, MatchLog } from "./matchTypes";
import type { BoardObjective, CareerState, Category, CompetitionInfo, Contract, Fixture, ManagerProfile, MatchResult, MatchdayReport, NewsItem, Player, PlayerAttrs, PlayerOverrides, SeasonStats, TeamTactics } from "./types";

export { defaultPlayerState, getPlayerState } from "./playerState";

export const GAME_VERSION = 17;
const START_DATE = "2025-08-16";
const SAVE_KEY = "fm25_career";

// ---- player access with per-career overrides -----------------------------

export function getPlayerCurrent(state: CareerState, id: number): Player {
  const base = getPlayer(id);
  const o = state.playerOverrides[id];
  if (!o) return base;
  const attrs = { ...base.attrs };
  for (const [k, delta] of Object.entries(o.attrs)) {
    if (delta != null) {
      const key = k as keyof PlayerAttrs;
      attrs[key] = Math.max(1, Math.min(20, base.attrs[key] + delta));
    }
  }
  return { ...base, age: o.age, ca: o.ca, attrs };
}

function caOf(state: CareerState) {
  return (id: number) => getPlayerCurrent(state, id).ca;
}

function makeNews(date: string, kind: NewsItem["kind"], headline: string, body: string): NewsItem {
  return { id: String(hashString(`${date}-${kind}-${headline}`)), date, kind, headline, body, read: false };
}

export function markAllNewsRead(state: CareerState): CareerState {
  return { ...state, inbox: state.inbox.map((n) => (n.read ? n : { ...n, read: true })) };
}

// ---- board / manager reputation -------------------------------------------

function boardObjectiveFor(strength: number, teamCount: number): BoardObjective {
  if (strength >= 160) return { targetPos: 4, description: "Finish in the top 4", status: "pending" };
  if (strength >= 150) return { targetPos: 6, description: "Finish in the top 6", status: "pending" };
  if (strength >= 135) return { targetPos: Math.round(teamCount / 2), description: "Finish in the top half", status: "pending" };
  return { targetPos: teamCount - 3, description: "Avoid relegation", status: "pending" };
}

export function boardConfidence(reputation: number): string {
  if (reputation >= 75) return "Delighted";
  if (reputation >= 60) return "Pleased";
  if (reputation >= 45) return "Satisfied";
  if (reputation >= 30) return "Concerned";
  return "Under pressure";
}

// ---- contracts & finances -------------------------------------------------

export function getContract(state: CareerState, id: number): Contract {
  return state.contracts[id] ?? { expirySeason: state.seasonStartYear + 3, wage: getPlayer(id).wage };
}

export function weeklyWages(state: CareerState): number {
  return (state.squads[state.userClubId] ?? []).reduce((s, id) => s + getContract(state, id).wage, 0);
}

export function weeklyIncome(state: CareerState): number {
  const strength = teamStrength(state.squads[state.userClubId] ?? [], (id) => getPlayerCurrent(state, id).ca);
  return Math.round(strength * 14_000);
}

export interface ContractOutcome {
  ok: boolean;
  message: string;
  state: CareerState;
}

export function renewContract(state: CareerState, playerId: number): ContractOutcome {
  const contract = getContract(state, playerId);
  const p = getPlayerCurrent(state, playerId);
  const asking = Math.max(contract.wage, Math.round(p.ca * 2000));
  const renewed: Contract = { expirySeason: state.seasonStartYear + 4, wage: asking };
  return {
    ok: true,
    message: `${p.name} signed until ${renewed.expirySeason} (${asking.toLocaleString("en-GB")}/wk)`,
    state: { ...state, contracts: { ...state.contracts, [playerId]: renewed } },
  };
}

function applyWeeklyFinance(state: CareerState): CareerState {
  const income = weeklyIncome(state);
  const wages = weeklyWages(state);
  return { ...state, balance: state.balance + income - wages };
}

// ---- morale & interactions -------------------------------------------------

export function moraleLabel(morale: number): string {
  if (morale >= 17) return "Superb";
  if (morale >= 15) return "Very Good";
  if (morale >= 13) return "Good";
  if (morale >= 11) return "Okay";
  if (morale >= 8) return "Poor";
  if (morale >= 5) return "Very Poor";
  return "Abysmal";
}

export function happinessReasons(state: CareerState, id: number): string[] {
  const ps = getPlayerState(state, id);
  const p = getPlayerCurrent(state, id);
  const reasons: string[] = [];
  if (p.ca >= 140 && ps.seasonMinutes < 400) reasons.push("Wants more playing time");
  if (ps.form.length && ps.form.reduce((a, b) => a + b, 0) / ps.form.length < 6.3) reasons.push("Unhappy with recent form");
  if (getContract(state, id).expirySeason <= state.seasonStartYear + 1) reasons.push("Concerned about their contract");
  if (ps.wantsTransfer) reasons.push("Wants to leave the club");
  if (!reasons.length) reasons.push(ps.morale >= 13 ? "Happy with life at the club" : "Content");
  return reasons;
}

export function interactWithPlayer(state: CareerState, id: number, kind: "praise" | "encourage" | "criticize"): { state: CareerState; message: string } {
  const ps = getPlayerState(state, id);
  const p = getPlayerCurrent(state, id);
  const delta = kind === "praise" ? 2 : kind === "encourage" ? 1 : -1;
  const morale = Math.max(1, Math.min(20, ps.morale + delta));
  const message = kind === "praise"
    ? `${p.name} responded well to your praise.`
    : kind === "encourage"
      ? `${p.name} appreciated the encouragement.`
      : `${p.name} took your criticism on board.`;
  return { state: { ...state, playerStates: { ...state.playerStates, [id]: { ...ps, morale } } }, message };
}

function weeklyMoraleUpdate(state: CareerState, playedBefore: Map<number, number>): CareerState {
  const squad = state.squads[state.userClubId] ?? [];
  let playerStates = state.playerStates;
  let inbox = state.inbox;
  for (const id of squad) {
    const p = getPlayerCurrent(state, id);
    const ps = getPlayerState(state, id);
    let morale = ps.morale;
    let wantsTransfer = ps.wantsTransfer;
    if (p.ca >= 140 && ps.seasonMinutes === (playedBefore.get(id) ?? 0)) morale = Math.max(1, morale - 1);
    if (morale <= 5 && !wantsTransfer) {
      wantsTransfer = true;
      inbox = [makeNews(state.date, "info", `${p.name} requests a transfer`, `${p.name} is unhappy and has asked to leave the club.`), ...inbox];
    }
    if (morale !== ps.morale || wantsTransfer !== ps.wantsTransfer) {
      playerStates = { ...playerStates, [id]: { ...ps, morale, wantsTransfer } };
    }
  }
  return { ...state, playerStates, inbox };
}

// ---- manager career -------------------------------------------------------

function seasonRecord(state: CareerState): { wins: number; draws: number; losses: number } {
  let wins = 0;
  let draws = 0;
  let losses = 0;
  for (const f of fixturesFor(state, state.userClubId)) {
    const res = state.results[f.id];
    if (!res) continue;
    const letter = fixtureResultLetter(res, state.userClubId);
    if (letter === "W") wins++;
    else if (letter === "D") draws++;
    else losses++;
  }
  return { wins, draws, losses };
}

function generateJobOffers(state: CareerState, reputation: number, sacked: boolean): number[] {
  const current = state.userClubId;
  const currentStrength = teamStrength(state.squads[current] ?? [], (id) => getPlayerCurrent(state, id).ca);
  const target = currentStrength + (reputation - 50) * 0.8;
  const candidates = db.teams
    .filter((t) => t.id !== current)
    .map((t) => ({ id: t.id, s: teamStrength(db.squadOf.get(t.id) ?? [], (id) => getPlayer(id).ca) }))
    .sort((a, b) => Math.abs(a.s - target) - Math.abs(b.s - target));
  const count = sacked ? 3 : 2;
  return candidates.slice(0, count).map((c) => c.id);
}

export function moveClub(state: CareerState, clubId: number): CareerState {
  const fresh = newCareer(clubId, state.saveName);
  return {
    ...fresh,
    reputation: state.reputation,
    manager: { ...state.manager, clubs: [...state.manager.clubs, clubId] },
    sacked: false,
    jobOffers: [],
    inbox: [makeNews(fresh.date, "info", `Welcome to ${db.teamById.get(clubId)!.name}`, "You have been appointed manager of the club."), ...fresh.inbox],
  };
}

// ---- competitions ----------------------------------------------------------

const COMPETITION_NAMES: Record<string, string> = {
  league: "League",
  cup: "FA Cup",
  ucl: "Champions League",
  uel: "Europa League",
};

const KNOCKOUT_SCHEDULES: Record<string, number[]> = {
  cup: [4, 9, 15, 22, 32],
  ucl: [3, 8, 14, 20, 31],
  uel: [3, 8, 14, 20, 31],
};

export function competitionName(id: string): string {
  return COMPETITION_NAMES[id] ?? id;
}

function qualifiers(userClubId: number, results: Record<string, MatchResult>, fixtures: Fixture[]): { ucl: number[]; uel: number[] } {
  const hasResults = Object.keys(results).length > 0;
  const ucl: number[] = [];
  const uel: number[] = [];
  for (const league of db.leagues) {
    let ordered: number[];
    const userLeague = league.teams.includes(userClubId);
    if (userLeague && hasResults) {
      ordered = computeStandings(league.teams, fixtures.filter((f) => f.competition === "league"), results).map((r) => r.teamId);
    } else {
      ordered = [...league.teams].sort(
        (a, b) => teamStrength(db.squadOf.get(b) ?? [], (id) => getPlayer(id).ca) - teamStrength(db.squadOf.get(a) ?? [], (id) => getPlayer(id).ca),
      );
    }
    ucl.push(...ordered.slice(0, 4));
    uel.push(...ordered.slice(4, 8));
  }
  return { ucl, uel };
}

function knockoutFixtures(compId: string, teams: number[], round: number, stage: number, seasonStartYear: number): Fixture[] {
  const rng = mulberry32(hashString(`${compId}-${seasonStartYear}-${round}`));
  const { matches } = pairKnockout(teams, rng);
  return matches.map(([a, b], i) => ({ id: `${compId}-r${round}-${i}`, stage, homeId: a, awayId: b, competition: compId }));
}

function advanceCompetitions(state: CareerState): CareerState {
  let fixtures = state.fixtures;
  const competitions = { ...state.competitions };
  let inbox = state.inbox;
  let reputation = state.reputation;
  let trophies = state.manager.trophies;

  for (const compId of ["cup", "ucl", "uel"] as const) {
    const comp = competitions[compId];
    const schedule = KNOCKOUT_SCHEDULES[compId];
    if (!comp || comp.round > schedule.length) continue;

    const stage = schedule[comp.round - 1];
    const roundFixtures = fixtures.filter((f) => f.competition === compId && f.stage === stage);
    if (roundFixtures.some((f) => !state.results[f.id])) continue;

    const winners = roundFixtures.map((f) => {
      const r = state.results[f.id];
      if (r.homeGoals === r.awayGoals) return hashString(f.id) % 2 === 0 ? f.homeId : f.awayId;
      return r.homeGoals > r.awayGoals ? f.homeId : f.awayId;
    });
    const byes = comp.teams.filter((t) => !roundFixtures.some((f) => f.homeId === t || f.awayId === t));
    const nextTeams = [...winners, ...byes];
    const nextRound = comp.round + 1;

    if (nextTeams.length === 1 && nextTeams[0] === state.userClubId) {
      inbox = [makeNews(state.date, "award", `You won the ${comp.name}!`, `Your side lifted the ${comp.name} trophy.`), ...inbox];
      reputation = clamp(reputation + 15, 0, 100);
      trophies += 1;
    }

    if (nextRound > schedule.length || nextTeams.length < 2) {
      competitions[compId] = { ...comp, round: nextRound, teams: nextTeams };
      continue;
    }
    fixtures = [...fixtures, ...knockoutFixtures(compId, nextTeams, nextRound, schedule[nextRound - 1], state.seasonStartYear)];
    competitions[compId] = { ...comp, round: nextRound, teams: nextTeams };
  }

  return { ...state, fixtures, competitions, inbox, reputation, manager: { ...state.manager, trophies } };
}

// ---- finances -------------------------------------------------------------

export function squadWages(squads: Record<number, number[]>, teamId: number): number {
  return (squads[teamId] ?? []).reduce((s, id) => s + getPlayer(id).wage, 0);
}

function startingBudget(teamId: number): number {
  const str = teamStrength(db.squadOf.get(teamId) ?? [], (id) => getPlayer(id).ca);
  const budget = Math.round((str - 110) * 1_250_000 / 100_000) * 100_000;
  return Math.max(2_000_000, Math.min(200_000_000, budget));
}

function prizeMoney(position: number, teamCount: number): number {
  return Math.round((teamCount - position + 1) * 2_400_000);
}

// ---- new career -----------------------------------------------------------

export function newCareer(clubId: number, saveName: string): CareerState {
  removeGeneratedPlayers();
  const league = db.leagueByTeam.get(clubId);
  if (!league) throw new Error("Club has no league");
  const teamIds = league.teams;
  const year = 2025;
  const q = qualifiers(clubId, {}, []);
  const leagueFixtures = generateFixtures(teamIds);
  const fixtures = [
    ...leagueFixtures,
    ...knockoutFixtures("cup", teamIds, 1, KNOCKOUT_SCHEDULES.cup[0], year),
    ...knockoutFixtures("ucl", q.ucl, 1, KNOCKOUT_SCHEDULES.ucl[0], year),
    ...knockoutFixtures("uel", q.uel, 1, KNOCKOUT_SCHEDULES.uel[0], year),
  ];
  const competitions: Record<string, CompetitionInfo> = {
    cup: { id: "cup", name: "FA Cup", round: 1, teams: [...teamIds] },
    ucl: { id: "ucl", name: "Champions League", round: 1, teams: q.ucl },
    uel: { id: "uel", name: "Europa League", round: 1, teams: q.uel },
  };

  const squads: Record<number, number[]> = {};
  for (const id of teamIds) squads[id] = [...(db.squadOf.get(id) ?? [])];

  const userSquad = squads[clubId] ?? [];
  const tactics = aiPickTactics(userSquad, (id) => getPlayer(id).ca, Math.random);

  return {
    version: GAME_VERSION,
    saveName,
    startedAt: new Date().toISOString(),
    date: START_DATE,
    seasonStartYear: year,
    dayOfWeek: 6,
    userClubId: clubId,
    balance: startingBudget(clubId),
    wageBudget: Math.round(squadWages(squads, clubId) * 1.1),
    squads,
    fixtures,
    competitions,
    results: {},
    nextStage: 1,
    totalStages: leagueFixtures[leagueFixtures.length - 1]?.stage ?? 1,
    seasonOver: false,
    seasonEndPrizeAwarded: false,
    transfers: [],
    playerOverrides: {},
    playerStates: {},
    seasonStats: {},
    generatedPlayers: {},
    nextPlayerId: GENERATED_ID_START + 1,
    latestIntake: [],
    inbox: [
      makeNews(START_DATE, "info", `Welcome to ${db.teamById.get(clubId)!.name}`, "You have taken over as manager. Your first league match is next week — set your tactics and get ready."),
    ],
    reputation: 50,
    boardObjective: boardObjectiveFor(teamStrength(db.squadOf.get(clubId) ?? [], (id) => getPlayer(id).ca), teamIds.length),
    contracts: {},
    manager: { trophies: 0, wins: 0, draws: 0, losses: 0, seasons: 0, clubs: [clubId] },
    sacked: false,
    jobOffers: [],
    tactics,
    matchLogs: {},
  };
}

// ---- tactics --------------------------------------------------------------

export function setTactics(state: CareerState, tactics: TeamTactics): CareerState {
  return { ...state, tactics };
}

// ---- standings ------------------------------------------------------------

export function leagueStandings(state: CareerState) {
  const league = db.leagueByTeam.get(state.userClubId);
  if (!league) return [];
  return computeStandings(league.teams, state.fixtures.filter((f) => f.competition === "league"), state.results);
}

export function userPosition(state: CareerState): number {
  const standings = leagueStandings(state);
  const idx = standings.findIndex((r) => r.teamId === state.userClubId);
  return idx + 1;
}

// ---- fixtures -------------------------------------------------------------

export function fixturesFor(state: CareerState, teamId: number): Fixture[] {
  return state.fixtures.filter((f) => f.homeId === teamId || f.awayId === teamId);
}

export function fixtureResultLetter(res: MatchResult, teamId: number): "W" | "D" | "L" {
  const gf = res.homeId === teamId ? res.homeGoals : res.awayGoals;
  const ga = res.homeId === teamId ? res.awayGoals : res.homeGoals;
  return gf > ga ? "W" : gf < ga ? "L" : "D";
}

export function teamRecentForm(state: CareerState, teamId: number, n: number): ("W" | "D" | "L")[] {
  return fixturesFor(state, teamId)
    .filter((f) => f.competition === "league" && state.results[f.id])
    .sort((a, b) => a.stage - b.stage)
    .slice(-n)
    .map((f) => fixtureResultLetter(state.results[f.id], teamId));
}

export function nextUserFixture(state: CareerState): Fixture | null {
  const upcoming = fixturesFor(state, state.userClubId).filter((f) => !state.results[f.id]);
  return upcoming.sort((a, b) => a.stage - b.stage)[0] ?? null;
}

// ---- matchday simulation --------------------------------------------------

function matchResultFromLog(log: MatchLog): MatchResult {
  const scorers = (teamId: number) =>
    log.events
      .filter((e): e is Extract<MatchEvent, { type: "goal" }> => e.type === "goal")
      .filter((e) => e.team === teamId)
      .map((e) => ({ playerId: e.playerId, minute: e.minute }));
  return {
    homeId: log.context.home.teamId,
    awayId: log.context.away.teamId,
    homeGoals: log.score.home,
    awayGoals: log.score.away,
    homeScorers: scorers(log.context.home.teamId),
    awayScorers: scorers(log.context.away.teamId),
  };
}

function playMatchday(state: CareerState): { state: CareerState; report: MatchdayReport } {
  if (state.seasonOver) return { state, report: { stage: state.nextStage, date: state.date, results: [], userResult: null, userLog: null } };

  const stage = state.nextStage;
  const matches = state.fixtures.filter((f) => f.stage === stage);
  const results = { ...state.results };
  const matchLogs = { ...state.matchLogs };
  const played: MatchResult[] = [];
  const logs: MatchLog[] = [];
  const seasonStats: Record<number, SeasonStats> = { ...state.seasonStats };
  let userResult: MatchResult | null = null;
  let userLog: MatchLog | null = null;
  const leagueName = db.leagueByTeam.get(state.userClubId)?.name ?? "League";

  const baseCa = caOf(state);
  const perfOf = (id: number) => matchPerformance(getPlayerState(state, id));
  const readinessOf = (id: number) => getPlayerState(state, id).fitness;
  const freshCaOf = (id: number) => baseCa(id) + (getPlayerState(state, id).condition - 80) / 4;

  const availableSquadOf = (teamId: number) => {
    const squad = state.squads[teamId] ?? db.squadOf.get(teamId) ?? [];
    const avail = squad.filter((id) => isAvailable(state, id));
    return avail.length >= 11 ? avail : squad;
  };

  for (const f of matches) {
    const homeSquad = availableSquadOf(f.homeId);
    const awaySquad = availableSquadOf(f.awayId);

    const homeTactics =
      f.homeId === state.userClubId
        ? state.tactics
        : aiPickTactics(homeSquad, freshCaOf, mulberry32(hashString(`home-${f.id}`)));
    const awayTactics =
      f.awayId === state.userClubId
        ? state.tactics
        : aiPickTactics(awaySquad, freshCaOf, mulberry32(hashString(`away-${f.id}`)));

    const context: MatchContext = {
      id: f.id,
      seed: hashString(`${f.id}-${state.seasonStartYear}`),
      home: buildMatchSquad(f.homeId, homeSquad, homeTactics, freshCaOf),
      away: buildMatchSquad(f.awayId, awaySquad, awayTactics, freshCaOf),
      competition: leagueName,
      stage,
    };

    const log = simulateMatch(context, baseCa, perfOf, readinessOf);
    const result = matchResultFromLog(log);
    results[f.id] = result;
    played.push(result);
    logs.push(log);

    const homeIds = new Set([...log.context.home.lineup.map((s) => s.playerId), ...log.context.home.bench]);
    if (f.competition === "league") {
      for (const [idStr, ps] of Object.entries(log.players)) {
        const id = Number(idStr);
        const s = seasonStats[id] ?? { appearances: 0, minutes: 0, goals: 0, assists: 0, cleanSheets: 0, ratingSum: 0 };
        s.appearances += 1;
        s.minutes += ps.minutes;
        s.goals += ps.goals;
        s.assists += ps.assists;
        s.ratingSum += ps.rating;
        if (log.score.away === 0 && homeIds.has(id)) s.cleanSheets += 1;
        else if (log.score.home === 0 && !homeIds.has(id)) s.cleanSheets += 1;
        seasonStats[id] = s;
      }
    }

    if (f.homeId === state.userClubId || f.awayId === state.userClubId) {
      if (f.competition === "league" || userLog == null) {
        userResult = result;
        userLog = log;
      }
      matchLogs[f.id] = log;
    }
  }

  const allIds = new Set<number>();
  for (const squad of Object.values(state.squads)) for (const id of squad) allIds.add(id);
  for (const id of Object.keys(state.playerStates)) allIds.add(Number(id));

  const playerStates = resolveWeekStates(state.playerStates, logs, [...allIds], state.seasonStartYear);

  let inbox = state.inbox;
  if (userResult && userLog) {
    const club = db.teamById.get(state.userClubId)!;
    const opp = db.teamById.get(userResult.homeId === state.userClubId ? userResult.awayId : userResult.homeId)!;
    const gf = userResult.homeId === state.userClubId ? userResult.homeGoals : userResult.awayGoals;
    const ga = userResult.homeId === state.userClubId ? userResult.awayGoals : userResult.homeGoals;
    const resultWord = gf > ga ? "beat" : gf < ga ? "lost to" : "drew with";
    inbox = [
      makeNews(state.date, "result", `${club.name} ${gf}–${ga} ${opp.name}`, `You ${resultWord} ${opp.name} on matchday ${stage}.`),
      ...inbox,
    ];

    const clubPlayers = new Set(state.squads[state.userClubId] ?? []);
    for (const e of userLog.events) {
      if (e.type === "injury" && clubPlayers.has(e.playerId)) {
        const p = getPlayer(e.playerId);
        inbox = [makeNews(state.date, "injury", `${p.name} injured`, `${p.name} suffered a ${e.severity} injury and is out.`), ...inbox];
      } else if (e.type === "card" && e.card === "red" && clubPlayers.has(e.playerId)) {
        const p = getPlayer(e.playerId);
        inbox = [makeNews(state.date, "suspension", `${p.name} sent off`, `${p.name} was sent off and will be suspended.`), ...inbox];
      }
    }
  }

  const base = {
    ...state,
    results,
    matchLogs,
    playerStates,
    seasonStats,
    inbox,
    nextStage: stage + 1,
    balance: state.balance,
    seasonOver: stage + 1 > state.totalStages,
  };
  const next = advanceCompetitions(base);
  return { state: next, report: { stage, date: state.date, results: played, userResult, userLog } };
}

const MATCHDAY = 0;

function dailyNews(state: CareerState, dayOfWeek: number): NewsItem | null {
  const club = db.teamById.get(state.userClubId)!;
  const next = nextUserFixture(state);
  const opp = next ? db.teamById.get(next.homeId === state.userClubId ? next.awayId : next.homeId) : null;

  if (dayOfWeek === 6 && next && opp) {
    return makeNews(state.date, "info", `Match preview: ${club.name} vs ${opp.name}`, `${club.name} face ${opp.name} tomorrow.`);
  }

  const squad = state.squads[state.userClubId] ?? [];
  if (squad.length) {
    const idx = hashString(`${state.date}-${dayOfWeek}`) % squad.length;
    const p = getPlayer(squad[idx]);
    const kind = hashString(`${state.date}-${dayOfWeek}-flavor`) % 4;
    if (kind === 0) return makeNews(state.date, "info", `${p.name} impressing in training`, `Coaching staff have praised ${p.name}'s recent form.`);
    if (kind === 1) return makeNews(state.date, "info", `${p.name} linked with a move`, `Reports suggest ${p.name} is attracting transfer interest.`);
    if (kind === 2) return makeNews(state.date, "info", "Board statement", "The board is monitoring the club's progress closely.");
    return makeNews(state.date, "info", "Supporters' view", "Fans are optimistic about the season ahead.");
  }
  return null;
}

export function advanceWeek(state: CareerState): { state: CareerState; report: MatchdayReport } {
  const { state: played, report } = playMatchday(state);
  if (played === state) return { state, report };
  return { state: { ...played, date: addDays(state.date, 7) }, report };
}

export function advance(state: CareerState): { state: CareerState; report: MatchdayReport | null } {
  if (state.seasonOver) return { state, report: null };
  const dayOfWeek = (state.dayOfWeek + 1) % 7;
  const date = addDays(state.date, 1);
  if (dayOfWeek === MATCHDAY) {
    const playedBefore = new Map((state.squads[state.userClubId] ?? []).map((id) => [id, getPlayerState(state, id).seasonMinutes]));
    const { state: played, report } = playMatchday(state);
    const updated = weeklyMoraleUpdate(played, playedBefore);
    return { state: { ...applyWeeklyFinance(updated), date, dayOfWeek }, report };
  }
  const item = dailyNews(state, dayOfWeek);
  return {
    state: { ...state, date, dayOfWeek, inbox: item ? [item, ...state.inbox] : state.inbox },
    report: null,
  };
}

// ---- transfers ------------------------------------------------------------

export function playerClub(state: CareerState, playerId: number): number | null {
  for (const [clubId, squad] of Object.entries(state.squads)) {
    if (squad.includes(playerId)) return Number(clubId);
  }
  return null;
}

export function buildPlayerClubMap(state: CareerState): Map<number, number | null> {
  const map = new Map<number, number | null>();
  for (const [clubId, squad] of Object.entries(state.squads)) {
    for (const pid of squad) map.set(pid, Number(clubId));
  }
  return map;
}

export interface TransferOutcome {
  ok: boolean;
  message: string;
  state: CareerState;
}

export function buyPlayer(state: CareerState, playerId: number): TransferOutcome {
  if (state.squads[state.userClubId]?.includes(playerId)) {
    return { ok: false, message: "Already in your squad", state };
  }
  const player = getPlayer(playerId);
  const fee = player.value;
  if (state.balance < fee) {
    return { ok: false, message: `Insufficient funds (need ${fee.toLocaleString("en-GB")})`, state };
  }

  const seller = playerClub(state, playerId);
  const squads = { ...state.squads };
  if (seller != null) {
    squads[seller] = squads[seller].filter((id) => id !== playerId);
  }
  squads[state.userClubId] = [...(squads[state.userClubId] ?? []), playerId];

  const transfer = {
    playerId,
    playerName: player.name,
    fromTeamId: seller,
    toTeamId: state.userClubId,
    fee,
    date: state.date,
    kind: "in" as const,
  };

  return {
    ok: true,
    message: `Signed ${player.name} for ${fee.toLocaleString("en-GB")}`,
    state: {
      ...state,
      squads,
      balance: state.balance - fee,
      transfers: [...state.transfers, transfer],
      inbox: [makeNews(state.date, "transfer", `Signed ${player.name}`, `You signed ${player.name} for ${fee.toLocaleString("en-GB")}.`), ...state.inbox],
    },
  };
}

export function sellPlayer(state: CareerState, playerId: number): TransferOutcome {
  if (!state.squads[state.userClubId]?.includes(playerId)) {
    return { ok: false, message: "Not in your squad", state };
  }
  const player = getPlayer(playerId);
  const fee = Math.round(player.value * 0.85);

  const candidates = db.teams.filter((t) => t.id !== state.userClubId);
  const buyer = candidates[Math.floor(Math.random() * candidates.length)];

  const squads = { ...state.squads };
  squads[state.userClubId] = squads[state.userClubId].filter((id) => id !== playerId);
  squads[buyer.id] = [...(squads[buyer.id] ?? []), playerId];

  const transfer = {
    playerId,
    playerName: player.name,
    fromTeamId: state.userClubId,
    toTeamId: buyer.id,
    fee,
    date: state.date,
    kind: "out" as const,
  };

  return {
    ok: true,
    message: `Sold ${player.name} to ${buyer.name} for ${fee.toLocaleString("en-GB")}`,
    state: {
      ...state,
      squads,
      balance: state.balance + fee,
      transfers: [...state.transfers, transfer],
      inbox: [makeNews(state.date, "transfer", `Sold ${player.name}`, `${player.name} joined ${buyer.name} for ${fee.toLocaleString("en-GB")}.`), ...state.inbox],
    },
  };
}

export function releasePlayer(state: CareerState, playerId: number): TransferOutcome {
  if (!state.squads[state.userClubId]?.includes(playerId)) {
    return { ok: false, message: "Not in your squad", state };
  }
  const player = getPlayer(playerId);
  const squads = { ...state.squads };
  squads[state.userClubId] = squads[state.userClubId].filter((id) => id !== playerId);

  const transfer = {
    playerId,
    playerName: player.name,
    fromTeamId: state.userClubId,
    toTeamId: null,
    fee: 0,
    date: state.date,
    kind: "release" as const,
  };

  return {
    ok: true,
    message: `Released ${player.name}`,
    state: {
      ...state,
      squads,
      transfers: [...state.transfers, transfer],
      inbox: [makeNews(state.date, "transfer", `Released ${player.name}`, `${player.name} has been released.`), ...state.inbox],
    },
  };
}

// ---- season rollover ------------------------------------------------------

export const CAT_ATTRS: Record<Category, (keyof PlayerAttrs)[]> = {
  FW: ["finishing", "offTheBall", "composure", "longShots", "acceleration", "pace", "dribbling", "heading"],
  MF: ["passing", "vision", "firstTouch", "technique", "composure", "stamina", "creativity"],
  DF: ["tackling", "marking", "positioning", "heading", "strength", "jumping", "anticipation"],
  GK: ["reflexes", "command", "handling", "oneOnOnes", "aerialReach", "communication"],
};

function growAttributes(player: Player, growth: number, training: keyof PlayerAttrs | null, prev: Partial<PlayerAttrs>): Partial<PlayerAttrs> {
  const result: Partial<PlayerAttrs> = { ...prev };
  const keys = CAT_ATTRS[player.category] ?? [];
  if (!keys.length) return result;
  const order: (keyof PlayerAttrs)[] = [];
  if (training && keys.includes(training)) order.push(training, training);
  for (const k of keys) order.push(k);

  let points = Math.round(growth * 1.2);
  let idx = 0;
  let guard = 0;
  while (points > 0 && guard < order.length * 40) {
    const key = order[idx % order.length];
    const cur = player.attrs[key] + (result[key] ?? 0);
    if (cur < 20) {
      result[key] = (result[key] ?? 0) + 1;
      points--;
    }
    idx++;
    guard++;
  }
  return result;
}

export function finishSeason(state: CareerState): CareerState {
  if (state.seasonEndPrizeAwarded || !state.seasonOver) return state;

  const league = db.leagueByTeam.get(state.userClubId);
  const position = userPosition(state);
  const prize = league ? prizeMoney(position, league.teams.length) : 0;

  const overrides: Record<number, PlayerOverrides> = {};
  for (const pid of db.players.keys()) {
    const cur = getPlayerCurrent(state, pid);
    const age = cur.age + 1;
    const gap = cur.pa - cur.ca;
    const ps = getPlayerState(state, pid);
    const prevAttrs = state.playerOverrides[pid]?.attrs ?? {};

    let ca = cur.ca;
    let attrs: Partial<PlayerAttrs> = { ...prevAttrs };
    if (gap > 0 && age <= 29) {
      const base = age <= 20 ? 12 : age <= 23 ? 6 : age <= 26 ? 4 : 2;
      const pers = cur.personality;
      const persF = clamp(0.6 + (pers.professionalism + pers.ambition + pers.determination) / 60, 0.5, 1.8);
      const playF = clamp(0.4 + 0.6 * ((ps.seasonMinutes ?? 0) / 2000), 0.4, 1);
      const growth = Math.min(gap, Math.round(base * persF * playF));
      ca = cur.ca + growth;
      attrs = growAttributes(cur, growth, ps.training, prevAttrs);
    } else if (age >= 33) {
      ca = Math.max(80, ca - 4);
    } else if (age >= 31) {
      ca = Math.max(80, ca - 2);
    }

    overrides[pid] = { age, ca, attrs };
  }

  const boot = topScorers(state, 1)[0];
  const potS = playerOfSeason(state);
  const club = db.teamById.get(state.userClubId)!;
  const awardNews: NewsItem[] = [
    makeNews(state.date, "award", `${club.name} finish ${position}`, `You finished ${position} in the league and earned ${prize.toLocaleString("en-GB")} in prize money.`),
  ];
  if (boot) {
    const p = getPlayer(boot.playerId);
    awardNews.push(makeNews(state.date, "award", `Golden Boot: ${p.name}`, `${p.name} won the Golden Boot with ${boot.goals} goals.`));
  }
  if (potS) {
    const p = getPlayer(potS.playerId);
    awardNews.push(makeNews(state.date, "award", `Player of the Season: ${p.name}`, `${p.name} was voted Player of the Season (${potS.rating.toFixed(2)} avg rating).`));
  }

  const objectiveMet = position <= state.boardObjective.targetPos;
  const reputation = clamp(state.reputation + (objectiveMet ? 12 : -12), 0, 100);
  const boardObjective: BoardObjective = { ...state.boardObjective, status: objectiveMet ? "met" : "failed" };
  awardNews.push(
    makeNews(
      state.date,
      "award",
      `Board verdict: ${objectiveMet ? "objective met" : "objective failed"}`,
      `The board expected you to "${state.boardObjective.description}". You finished ${position}.`,
    ),
  );

  const record = seasonRecord(state);
  const manager: ManagerProfile = {
    ...state.manager,
    wins: state.manager.wins + record.wins,
    draws: state.manager.draws + record.draws,
    losses: state.manager.losses + record.losses,
    seasons: state.manager.seasons + 1,
  };
  const sacked = reputation <= 15;
  const jobOffers = generateJobOffers(state, reputation, sacked);
  if (sacked) {
    awardNews.push(makeNews(state.date, "info", `Sacked by ${club.name}`, "The board have relieved you of your duties."));
  }

  return {
    ...state,
    balance: state.balance + prize,
    seasonEndPrizeAwarded: true,
    playerOverrides: overrides,
    reputation,
    boardObjective,
    manager,
    sacked,
    jobOffers,
    inbox: [...awardNews, ...state.inbox],
  };
}

export function setTraining(state: CareerState, playerId: number, focus: keyof PlayerAttrs | null): CareerState {
  const ps = getPlayerState(state, playerId);
  return { ...state, playerStates: { ...state.playerStates, [playerId]: { ...ps, training: focus } } };
}

// ---- youth intake ----------------------------------------------------------

const ATTR_KEYS: (keyof PlayerAttrs)[] = [
  "corners", "crossing", "dribbling", "finishing", "firstTouch", "freeKicks", "heading",
  "longShots", "marking", "passing", "penalties", "tackling", "technique",
  "aggression", "anticipation", "bravery", "composure", "concentration", "creativity",
  "decisions", "flair", "offTheBall", "positioning", "teamwork", "vision", "workRate",
  "acceleration", "agility", "balance", "jumping", "naturalFitness", "pace", "stamina", "strength",
  "aerialReach", "command", "communication", "handling", "kicking", "oneOnOnes", "reflexes", "throwing",
];

const GK_ATTRS: (keyof PlayerAttrs)[] = ["aerialReach", "command", "communication", "handling", "kicking", "oneOnOnes", "reflexes", "throwing"];

const YOUTH_POSITIONS: Record<Category, string[]> = {
  GK: ["GK"],
  DF: ["CB", "LB", "RB"],
  MF: ["CM", "CDM", "CAM", "LM", "RM"],
  FW: ["ST", "CF", "LW", "RW"],
};

const namePools = (() => {
  const first = new Set<string>();
  const last = new Set<string>();
  for (const p of db.players.values()) {
    const parts = p.name.trim().split(/\s+/);
    if (parts.length >= 2) {
      first.add(parts[0]);
      last.add(parts[parts.length - 1]);
    }
  }
  return { first: [...first], last: [...last] };
})();

function generateYouthPlayer(rng: Rng, id: number, ca: number): Player {
  const age = 15 + Math.floor(rng() * 3);
  const pa = Math.min(199, ca + 30 + Math.floor(rng() * 70));
  const roll = rng();
  const category: Category = roll < 0.1 ? "GK" : roll < 0.35 ? "DF" : roll < 0.62 ? "MF" : "FW";
  const positions = YOUTH_POSITIONS[category];
  const position = positions[Math.floor(rng() * positions.length)];

  const attrs = {} as PlayerAttrs;
  const base = Math.round(ca / 6);
  const keys = CAT_ATTRS[category];
  for (const key of ATTR_KEYS) {
    let v = base;
    if (keys.includes(key)) v += 4;
    else if (category === "GK" ? !GK_ATTRS.includes(key) : GK_ATTRS.includes(key)) v -= 4;
    v += Math.round((rng() - 0.5) * 4);
    attrs[key] = Math.max(1, Math.min(20, v));
  }

  const name = `${namePools.first[Math.floor(rng() * namePools.first.length)]} ${namePools.last[Math.floor(rng() * namePools.last.length)]}`;
  return {
    name,
    age,
    nation: null,
    position,
    altPositions: [],
    category,
    height: 165 + Math.floor(rng() * 30),
    weight: 55 + Math.floor(rng() * 35),
    foot: rng() < 0.6 ? "right" : "left",
    weakFoot: 1 + Math.floor(rng() * 5),
    skillMoves: 1 + Math.floor(rng() * 5),
    ca,
    pa,
    value: Math.round(Math.max(0, ca - 40) ** 2 * 1500),
    wage: Math.max(400, Math.round(ca * 200)),
    attrs,
    personality: generatePersonality(id, name),
  };
}

export function startNextSeason(state: CareerState): CareerState {
  const finished = finishSeason(state);
  const league = db.leagueByTeam.get(finished.userClubId);
  if (!league) return finished;
  const year = finished.seasonStartYear + 1;
  const q = qualifiers(finished.userClubId, finished.results, finished.fixtures);
  const leagueFixtures = generateFixtures(league.teams);
  const fixtures = [
    ...leagueFixtures,
    ...knockoutFixtures("cup", league.teams, 1, KNOCKOUT_SCHEDULES.cup[0], year),
    ...knockoutFixtures("ucl", q.ucl, 1, KNOCKOUT_SCHEDULES.ucl[0], year),
    ...knockoutFixtures("uel", q.uel, 1, KNOCKOUT_SCHEDULES.uel[0], year),
  ];
  const competitions: Record<string, CompetitionInfo> = {
    cup: { id: "cup", name: "FA Cup", round: 1, teams: [...league.teams] },
    ucl: { id: "ucl", name: "Champions League", round: 1, teams: q.ucl },
    uel: { id: "uel", name: "Europa League", round: 1, teams: q.uel },
  };

  const rng = mulberry32(hashString(`youth-${finished.seasonStartYear}-${finished.userClubId}`));
  const strength = teamStrength(finished.squads[finished.userClubId] ?? [], (id) => getPlayerCurrent(finished, id).ca);

  const generatedPlayers = { ...finished.generatedPlayers };
  const intakeIds: number[] = [];
  let nextId = finished.nextPlayerId;
  const rawSquad = finished.squads[finished.userClubId] ?? [];
  const leavers = rawSquad.filter((id) => getContract(finished, id).expirySeason <= year);
  const squad = rawSquad.filter((id) => !leavers.includes(id));
  const expiryNews = leavers.map((id) =>
    makeNews(START_DATE, "transfer", `${getPlayer(id).name} left the club`, `${getPlayer(id).name}'s contract expired and they departed on a free transfer.`),
  );
  for (let i = 0; i < 3; i++) {
    const ca = 40 + Math.floor(rng() * 25) + Math.max(0, Math.round((strength - 140) / 4));
    const id = nextId++;
    const player = generateYouthPlayer(rng, id, ca);
    generatedPlayers[id] = player;
    addGeneratedPlayer(id, player);
    intakeIds.push(id);
    squad.push(id);
  }

  return {
    ...finished,
    seasonStartYear: year,
    date: START_DATE,
    dayOfWeek: 6,
    fixtures,
    competitions,
    results: {},
    nextStage: 1,
    totalStages: leagueFixtures[leagueFixtures.length - 1]?.stage ?? 1,
    seasonOver: false,
    seasonEndPrizeAwarded: false,
    playerStates: {},
    seasonStats: {},
    boardObjective: boardObjectiveFor(teamStrength(squad, (id) => getPlayerCurrent(finished, id).ca), league.teams.length),
    generatedPlayers,
    nextPlayerId: nextId,
    latestIntake: intakeIds,
    squads: { ...finished.squads, [finished.userClubId]: squad },
    inbox: [makeNews(START_DATE, "intake", "New youth intake", `${intakeIds.length} youth prospects have joined the academy squad.`), ...expiryNews, ...finished.inbox],
  };
}

export function clearLatestIntake(state: CareerState): CareerState {
  return { ...state, latestIntake: [] };
}

export function topScorers(state: CareerState, n: number): { playerId: number; goals: number; assists: number }[] {
  return Object.entries(state.seasonStats)
    .map(([id, s]) => ({ playerId: Number(id), goals: s.goals, assists: s.assists }))
    .filter((r) => r.goals > 0)
    .sort((a, b) => b.goals - a.goals || b.assists - a.assists)
    .slice(0, n);
}

export function topAssists(state: CareerState, n: number): { playerId: number; goals: number; assists: number }[] {
  return Object.entries(state.seasonStats)
    .map(([id, s]) => ({ playerId: Number(id), goals: s.goals, assists: s.assists }))
    .filter((r) => r.assists > 0)
    .sort((a, b) => b.assists - a.assists || b.goals - a.goals)
    .slice(0, n);
}

export function playerOfSeason(state: CareerState): { playerId: number; rating: number } | null {
  const candidates = Object.entries(state.seasonStats)
    .filter(([, s]) => s.appearances >= 20)
    .map(([id, s]) => ({ playerId: Number(id), rating: s.ratingSum / s.appearances }));
  if (!candidates.length) return null;
  return candidates.sort((a, b) => b.rating - a.rating)[0];
}

// ---- persistence ----------------------------------------------------------

export function saveCareer(state: CareerState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
}

export function loadCareer(): CareerState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CareerState;
    if (parsed.version !== GAME_VERSION) return null;
    syncGeneratedPlayers(parsed.generatedPlayers ?? {});
    return parsed;
  } catch {
    return null;
  }
}

export function clearSave(): void {
  localStorage.removeItem(SAVE_KEY);
}
