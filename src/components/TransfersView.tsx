import { useMemo, useState } from "react";
import { db } from "../game/data";
import { buildPlayerClubMap, buyPlayer, getPlayerCurrent } from "../game/career";
import { nationFlag } from "../game/nations";
import { formatMoney } from "../game/format";
import type { CareerState } from "../game/types";
import { sortBy, useSort } from "../hooks/useSort";
import { PlayerPanel } from "./PlayerPanel";
import { AbilityStars, SortHeader } from "./ui";

interface Props {
  career: CareerState;
  apply: (next: CareerState) => void;
}

const CATS = ["All", "GK", "DF", "MF", "FW"] as const;
const PAGE = 100;

export function TransfersView({ career, apply }: Props) {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<(typeof CATS)[number]>("All");
  const [league, setLeague] = useState<string>("All");
  const [limit, setLimit] = useState(PAGE);
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const { sort, toggle } = useSort("ca");

  const clubOf = useMemo(() => buildPlayerClubMap(career), [career]);

  const clubName = (id: number | null, inSquad: boolean) => (inSquad ? "Your squad" : id != null ? db.teamById.get(id)!.name : "Free Agent");

  const results = useMemo(() => {
    const list: { id: number; ca: number; pa: number; value: number; age: number; clubId: number | null; pos: string; cat: string; name: string; nation: string | null; inSquad: boolean }[] = [];
    const mySquad = career.squads[career.userClubId] ?? [];
    for (const id of db.players.keys()) {
      const p = getPlayerCurrent(career, id);
      const clubId = clubOf.get(id) ?? null;
      list.push({ id, ca: p.ca, pa: p.pa, value: p.value, age: p.age, clubId, pos: p.position, cat: p.category, name: p.name, nation: p.nation, inSquad: mySquad.includes(id) });
    }
    const q = query.trim().toLowerCase();
    const filtered = list.filter((x) => {
      if (cat !== "All" && x.cat !== cat) return false;
      if (q && !x.name.toLowerCase().includes(q)) return false;
      if (league !== "All") {
        if (league === "Free Agents") { if (x.clubId != null) return false; }
        else { const t = x.clubId != null ? db.teamById.get(x.clubId) : null; if (!t || t.league !== league) return false; }
      }
      return true;
    });
    return sortBy(filtered, sort, (x, key) => {
      switch (key) {
        case "name": return x.name.toLowerCase();
        case "nation": return x.nation ?? "";
        case "position": return x.pos;
        case "club": return clubName(x.clubId, x.inSquad);
        case "ca": return x.ca;
        case "age": return x.age;
        case "value": return x.value;
        default: return x.ca;
      }
    });
  }, [career, clubOf, query, cat, league, sort]);

  const leagues = ["All", "Free Agents", ...db.leagues.map((l) => l.name)];
  const shown = results.slice(0, limit);

  const doBuy = (id: number) => {
    const out = buyPlayer(career, id);
    if (out.ok) { apply(out.state); setSelected(null); setFeedback(out.message); }
    else setFeedback(out.message);
  };

  const selectedPlayer = selected != null ? getPlayerCurrent(career, selected) : null;
  const selectedClubId = selected != null ? (clubOf.get(selected) ?? null) : null;

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
        <div className="btn-row" style={{ flexWrap: "wrap", marginBottom: 12 }}>
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
                <td><AbilityStars ca={x.ca} pa={x.pa} /></td>
                <td className="num">{x.age}</td>
                <td className="num">{formatMoney(x.value)}</td>
                <td className="num">
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
            <PlayerPanel player={selectedPlayer} />
            <div className="banner" style={{ marginTop: 16, marginBottom: 0 }}>
              <div className="msg">
                <b>{selectedClubId != null ? db.teamById.get(selectedClubId)!.name : "Free Agent"}</b>
                {" · "}asking {formatMoney(selectedPlayer.value)}
              </div>
              <button className="btn primary" onClick={() => doBuy(selected)}>Buy for {formatMoney(selectedPlayer.value)}</button>
              <button className="btn small" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
