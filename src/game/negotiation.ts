import { clamp } from "./scales";
import { teamStrength } from "./strength";
import type { Contract, Player, PlayerState } from "./types";

// A club's reputation (0-100) derived from its playing strength, used as a
// proxy for how "prestigious" a destination feels to a player.
export function reputationFromStrength(strength: number): number {
  return clamp(Math.round((strength - 115) * 2), 0, 100);
}

// How much a player will ask for per week on a contract of the given length.
// Returns Infinity when the player flat-out refuses to negotiate.
export function wageDemand(player: Player, ps: PlayerState, contract: Contract, seasonStartYear: number, lengthYears: number): number {
  if (ps.wantsTransfer) return Infinity;

  const cur = Math.max(1, contract.wage);
  let m = 1.0;

  if (ps.morale >= 16) m += 0.25;
  else if (ps.morale >= 13) m += 0.1;

  const form = ps.form.slice(-5);
  if (form.length >= 3 && form.reduce((a, b) => a + b, 0) / form.length >= 7.5) m += 0.1;

  if (player.age >= 33) m -= 0.25;
  else if (player.age >= 30) m -= 0.1;
  else if (player.age <= 23 && player.pa - player.ca >= 25) m += 0.2;

  if (contract.expirySeason <= seasonStartYear + 1) m += 0.1;
  if (player.personality.ambition >= 15) m += 0.1;

  // Buying extra years costs more; a short deal is cheaper.
  m += (lengthYears - 3) * 0.04;

  // Ability floor so a top player can never be signed on poverty wages.
  const caFloor = Math.round(1000 * Math.pow(1.03, player.ca - 110));

  const demand = Math.max(cur, caFloor) * Math.max(0.5, m);
  return Math.max(500, Math.ceil(demand / 100) * 100);
}

export interface ContractOfferResult {
  accepted: boolean;
  message: string;
  counter: number;
}

export function evaluateContractOffer(demand: number, offerWage: number): ContractOfferResult {
  if (demand === Infinity) return { accepted: false, message: "The player is not willing to discuss a new contract.", counter: Infinity };
  if (offerWage >= demand) return { accepted: true, message: "", counter: demand };
  if (offerWage >= demand * 0.9) return { accepted: true, message: "Accepted, though not entirely satisfied with the terms.", counter: demand };
  return { accepted: false, message: "", counter: Math.round((demand * 1.05) / 100) * 100 };
}

// The fee the selling club will demand, beyond the raw market value.
export function askingPrice(player: Player, contract: Contract, squadStrength: number, seasonStartYear: number): number {
  let price = player.value;

  const star = clamp(player.ca - squadStrength, 0, 40);
  price *= 1 + star / 100;

  const yearsLeft = contract.expirySeason - seasonStartYear;
  if (yearsLeft <= 1) price *= 0.5;
  else if (yearsLeft <= 2) price *= 0.8;

  return Math.max(100_000, Math.round(price / 100_000) * 100_000);
}

export interface WillJoinInput {
  player: Player;
  morale: number;
  wantsTransfer: boolean;
  currentWage: number;
  currentClubStrength: number; // 0 if free agent
  targetClubStrength: number;
  targetReputation: number;
  offeredWage: number;
}

export interface WillJoinResult {
  willing: boolean;
  reason: string;
}

export function willJoin(i: WillJoinInput): WillJoinResult {
  const { player, morale, wantsTransfer, currentWage, currentClubStrength, targetClubStrength, targetReputation, offeredWage } = i;
  const step = targetClubStrength - currentClubStrength;
  const happy = morale >= 14 && !wantsTransfer;
  const freeAgent = currentClubStrength === 0;
  const age = player.age;
  const ambition = player.personality.ambition;

  if (!freeAgent && happy && step < 12) {
    return { willing: false, reason: `${player.name} is settled at their current club.` };
  }

  if (!freeAgent && targetClubStrength < player.ca - 25) {
    const desperate = wantsTransfer || morale <= 6;
    const bigMoney = offeredWage >= currentWage * 1.5;
    const veteran = age >= 30;
    if (!desperate && !bigMoney && !veteran) {
      return { willing: false, reason: `${player.name} feels the club is not at their level.` };
    }
  }

  if (!freeAgent && step < -15 && age <= 24 && ambition >= 13 && !wantsTransfer) {
    return { willing: false, reason: `${player.name} is unwilling to take a step down at this stage of their career.` };
  }

  if (player.ca >= 160 && targetReputation < 30 && step < 0) {
    return { willing: false, reason: `${player.name} wants to join a more prestigious club.` };
  }

  return { willing: true, reason: "" };
}

// Convenience: club strength given a squad and a CA resolver.
export function squadStrengthOf(squad: number[], caOf: (id: number) => number): number {
  return teamStrength(squad, caOf);
}
