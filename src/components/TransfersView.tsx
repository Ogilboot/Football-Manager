import { useMemo, useState } from "react";
import { db } from "../game/data";
import { ALL_POSITIONS, addToShortlist, buildPlayerClubMap, comfortablePositions, getPlayerCurrent, isShortlisted, removeFromShortlist, scoutKnowledgeOf } from "../game/career";
import { nationFlag } from "../game/nations";
import { formatMoney } from "../game/format";
import { knowledgeLevel, reputationMinCa, REPUTATION_TIERS, revealCa, type KnowledgeLevel } from "../game/scouting";
import type { CareerState, PlayerAttrs } from "../game/types";
import { sortBy, useSort } from "../hooks/useSort";
import { BidModal } from "./BidModal";
import { PlayerPanel } from "./PlayerPanel";
import { ScoutedStars, SortHeader } from "./ui";

interface Props {
  career: CareerState;
  apply: (next: CareerState) => void;
}

const CATS = ["All", "GK", "DF", "MF", "FW"] as const;
const PAGE = 100;

const SEARCH_ATTRS: [keyof PlayerAttrs, string][] = [
  ["finishing", "Finishing"],
  ["pace", "Pace"],
  ["acceleration", "Acceleration"],
  ["strength", "Strength"],
  ["passing", "Passing"],
  ["vision", "Vision"],
  ["dribbling", "Dribbling"],
  ["heading", "Heading"],
  ["tackling", "Tackling"],
  ["marking", "Marking"],
  ["positioning", "Positioning"],
  ["composure", "Composure"],
  ["reflexes", "Reflexes"],
  ["handling", "Handling"],
  ["stamina", "Stamina"],
  ["technique", "Technique"],
  ["firstTouch", "First Touch"],
  ["crossing", "Crossing"],
  ["longShots", "Long Shots"],
  ["offTheBall", "Off The Ball"],
  ["anticipation", "Anticipation"],
  ["workRate", "Work Rate"],
];

export function TransfersView({ career, apply }: Props) {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<(typeof CATS)[number]>("All");
  const [league, setLeague] = useState<string>("All");
  const [position, setPosition] = useState("All");
  const [reputation, setReputation] = useState("Any");
  const [attrKey, setAttrKey] = useState("");
  const [attrMin, setAttrMin] = useState(15);
  const [scoutFilter, setScoutFilter] = useState<"all" | "shortlisted" | "scouted" | "unscouted">("all");
  const [limit, setLimit] = useState(PAGE);
  const [selected, setSelected] = useState<number | null>(null);
  const [bidding, setBidding] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const { sort, toggle } = useSort("ca");

  const clubOf = useMemo(() => buildPlayerClubMap(career), [career]);

  const clubName = (id: number | null, inSquad: boolean) => (inSquad ? "Your squad" : id != null ? db.teamById.get(id)!.name : "Free Agent");

  const results = useMemo(() => {
    const list: { id: number; ca: number; pa: number; value: number; age: number; clubId: number | null; pos: string; cat: string; name: string; nation: string | null; inSquad: boolean; level: KnowledgeLevel; sortCa: number }[] = [];
    const mySquad = career.squads[career.userClubId] ?? [];
    for (const id of db.players.keys()) {
      const p = getPlayerCurrent(career, id);
      const clubId = clubOf.get(id) ?? null;
      const level = knowledgeLevel(scoutKnowledgeOf(career, id));
      const sortCa = level === "unknown" ? -1 : level === "partial" ? (revealCa(p.ca, "partial") ?? -1) : p.ca;
      list.push({ id, ca: p.ca, pa: p.pa, value: p.value, age: p.age, clubId, pos: p.position, cat: p.category, name: p.name, nation: p.nation, inSquad: mySquad.includes(id), level, sortCa });
    }
    const q = query.trim().toLowerCase();
    const filtered = list.filter((x) => {
      if (cat !== "All" && x.cat !== cat) return false;
      if (q && !x.name.toLowerCase().includes(q)) return false;
      if (league !== "All") {
        if (league === "Free Agents") { if (x.clubId != null) return false; }
        else { const t = x.clubId != null ? db.teamById.get(x.clubId) : null; if (!t || t.league !== league) return false; }
      }
      if (position !== "All" && !comfortablePositions(getPlayerCurrent(career, x.id)).includes(position)) return false;
      if (reputation !== "Any") {
        const min = reputationMinCa(reputation);
        if (min != null && x.ca < min) return false;
      }
      if (attrKey) {
        if (x.level !== "full") return false;
        if (getPlayerCurrent(career, x.id).attrs[attrKey as keyof PlayerAttrs] < attrMin) return false;
      }
      if (scoutFilter === "shortlisted" && !isShortlisted(career, x.id)) return false;
      if (scoutFilter === "scouted" && x.level !== "full") return false;
      if (scoutFilter === "unscouted" && x.level === "full") return false;
      return true;
    });
    return sortBy(filtered, sort, (x, key) => {
      switch (key) {
        case "name": return x.name.toLowerCase();
        case "nation": return x.nation ?? "";
        case "position": return x.pos;
        case "club": return clubName(x.clubId, x.inSquad);
        case "ca": return x.sortCa;
        case "age": return x.age;
        case "value": return x.value;
        default: return x.sortCa;
      }
    });
  }, [career, clubOf, query, cat, league, position, reputation, attrKey, attrMin, scoutFilter, sort]);

  const leagues = ["All", "Free Agents", ...db.leagues.map((l) => l.name)];
  const shown = results.slice(0, limit);

  const doBuy = (id: number) => {
    setSelected(null);
    setBidding(id);
  };

  const doScout = (id: number) => {
    apply(addToShortlist(career, id));
    setFeedback("Scout assigned — a report will build up as scouting progresses.");
  };

  const doStopScout = (id: number) => {
    apply(removeFromShortlist(career, id));
    setFeedback("Removed from the shortlist.");
  };

  const selectedPlayer = selected != null ? getPlayerCurrent(career, selected) : null;
  const selectedClubId = selected != null ? (clubOf.get(selected) ?? null) : null;
  const selectedKnowledge = selected != null ? scoutKnowledgeOf(career, selected) : 100;
  const selectedLevel = knowledgeLevel(selectedKnowledge);

  return (
    <div>
      {feedback && (
        <div className="banner">
          <div className="msg">{feedback}</div>
          <button className="btn small" onClick={() => setFeedback(null)}>OK</button>
        </div>
      )}

      <div className="panel">
        <div className="panel-title">Scouting</div>
        <div className="btn-row" style={{ flexWrap: "wrap", marginBottom: 8 }}>
          <input
            type="text"
            placeholder="Search players…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setLimit(PAGE); }}
            style={{ flex: 1, minWidth: 180 }}
          />
          <select value={cat} onChange={(e) => { setCat(e.target.value as typeof cat); setLimit(PAGE); }}>
            {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={league} onChange={(e) => { setLeague(e.target.value); setLimit(PAGE); }}>
            {leagues.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div className="btn-row" style={{ flexWrap: "wrap", marginBottom: 8 }}>
          <select value={position} onChange={(e) => { setPosition(e.target.value); setLimit(PAGE); }}>
            <option value="All">Any position</option>
            {ALL_POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={reputation} onChange={(e) => { setReputation(e.target.value); setLimit(PAGE); }}>
            <option value="Any">Any reputation</option>
            {REPUTATION_TIERS.map((r) => <option key={r} value={r}>Rep: {r}+</option>)}
          </select>
          <select value={attrKey} onChange={(e) => { setAttrKey(e.target.value); setLimit(PAGE); }}>
            <option value="">No attribute filter</option>
            {SEARCH_ATTRS.map(([k, label]) => <option key={k} value={k}>{label} ≥ {attrMin}</option>)}
          </select>
          <select value={attrMin} onChange={(e) => setAttrMin(Number(e.target.value))} disabled={!attrKey}>
            {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <select value={scoutFilter} onChange={(e) => { setScoutFilter(e.target.value as typeof scoutFilter); setLimit(PAGE); }}>
            <option value="all">All players</option>
            <option value="shortlisted">Shortlisted</option>
            <option value="scouted">Fully scouted</option>
            <option value="unscouted">Not fully scouted</option>
          </select>
        </div>

        <div className="muted small" style={{ marginBottom: 8 }}>
          Showing {Math.min(shown.length, limit)} of {results.length} players
        </div>

        <table className="table">
          <thead>
            <tr>
              <SortHeader label="Name" sortKey="name" sort={sort} onSort={toggle} />
              <SortHeader label="Nat" sortKey="nation" sort={sort} onSort={toggle} />
              <SortHeader label="Pos" sortKey="position" sort={sort} onSort={toggle} />
              <SortHeader label="Club" sortKey="club" sort={sort} onSort={toggle} />
              <SortHeader label="Ability" sortKey="ca" sort={sort} onSort={toggle} />
              <SortHeader label="Age" sortKey="age" sort={sort} onSort={toggle} num />
              <SortHeader label="Value" sortKey="value" sort={sort} onSort={toggle} num />
              <th></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((x) => (
              <tr key={x.id} className="row-click" onClick={() => setSelected(x.id)}>
                <td>{x.name}</td>
                <td title={x.nation ?? ""}>{nationFlag(x.nation) ?? "—"}</td>
                <td>{x.pos}</td>
                <td className="dim">{x.inSquad ? "Your squad" : x.clubId != null ? db.teamById.get(x.clubId)!.name : "Free Agent"}</td>
                <td><ScoutedStars ca={x.ca} pa={x.pa} level={x.level} /></td>
                <td className="num">{x.age}</td>
                <td className="num">{formatMoney(x.value)}</td>
                <td className="num" style={{ whiteSpace: "nowrap" }}>
                  {!x.inSquad && (
                    isShortlisted(career, x.id)
                      ? <button className="btn small" onClick={(e) => { e.stopPropagation(); doStopScout(x.id); }}>Stop</button>
                      : <button className="btn small" onClick={(e) => { e.stopPropagation(); doScout(x.id); }}>Scout</button>
                  )}
                  <button className="btn small primary" onClick={(e) => { e.stopPropagation(); doBuy(x.id); }} disabled={x.inSquad}>
                    Buy
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {limit < results.length && (
          <div style={{ textAlign: "center", marginTop: 12 }}>
            <button className="btn" onClick={() => setLimit((l) => l + PAGE)}>Show more</button>
          </div>
        )}
      </div>

      {selectedPlayer && selected != null && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <PlayerPanel player={selectedPlayer} knowledge={selectedKnowledge} />
            <div className="banner" style={{ marginTop: 16, marginBottom: 0 }}>
              <div className="msg">
                <b>{selectedClubId != null ? db.teamById.get(selectedClubId)!.name : "Free Agent"}</b>
                {" · "}asking {formatMoney(selectedPlayer.value)}
                <div className="small muted">
                  {selectedLevel === "unknown" ? "Not scouted — assign a scout to reveal attributes" : selectedLevel === "partial" ? "Partially scouted — attributes are approximate" : "Fully scouted"}
                </div>
              </div>
              {selected != null && !isShortlisted(career, selected) && !(career.squads[career.userClubId] ?? []).includes(selected) && (
                <button className="btn" onClick={() => doScout(selected)}>Scout</button>
              )}
              {selected != null && isShortlisted(career, selected) && (
                <button className="btn" onClick={() => doStopScout(selected)}>Stop scouting</button>
              )}
              <button className="btn primary" onClick={() => doBuy(selected)}>Make offer</button>
              <button className="btn small" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {bidding != null && (
        <BidModal
          career={career}
          playerId={bidding}
          playerName={getPlayerCurrent(career, bidding).name}
          onClose={() => setBidding(null)}
          apply={apply}
        />
      )}
    </div>
  );
}
