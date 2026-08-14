import { useMemo, useState } from "react";
import { db } from "../game/data";
import { buildPlayerClubMap, buyPlayer, getPlayerCurrent } from "../game/career";
import { formatMoney } from "../game/format";
import type { CareerState } from "../game/types";
import { PlayerPanel } from "./PlayerPanel";
import { RatingBadge } from "./ui";

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
  const [sort, setSort] = useState<"ca" | "value" | "age">("ca");
  const [limit, setLimit] = useState(PAGE);
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const clubOf = useMemo(() => buildPlayerClubMap(career), [career]);

  const results = useMemo(() => {
    const list: { id: number; ca: number; pa: number; value: number; age: number; clubId: number | null; pos: string; cat: string; name: string; inSquad: boolean }[] = [];
    const mySquad = career.squads[career.userClubId] ?? [];
    for (const id of db.players.keys()) {
      const p = getPlayerCurrent(career, id);
      const clubId = clubOf.get(id) ?? null;
      list.push({ id, ca: p.ca, pa: p.pa, value: p.value, age: p.age, clubId, pos: p.position, cat: p.category, name: p.name, inSquad: mySquad.includes(id) });
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
    filtered.sort((a, b) => (sort === "value" ? b.value - a.value : sort === "age" ? a.age - b.age : b.ca - a.ca));
    return filtered;
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
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
            <option value="ca">Sort: Ability</option>
            <option value="value">Sort: Value</option>
            <option value="age">Sort: Age</option>
          </select>
        </div>

        <div className="muted small" style={{ marginBottom: 8 }}>
          Showing {Math.min(shown.length, limit)} of {results.length} players
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>Name</th><th>Pos</th><th>Club</th><th className="num">CA</th>
              <th className="num">PA</th><th className="num">Age</th><th className="num">Value</th><th></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((x) => (
              <tr key={x.id} className="row-click" onClick={() => setSelected(x.id)}>
                <td>{x.name}</td>
                <td>{x.pos}</td>
                <td className="dim">{x.inSquad ? "Your squad" : x.clubId != null ? db.teamById.get(x.clubId)!.name : "Free Agent"}</td>
                <td className="num"><RatingBadge ca={x.ca} /></td>
                <td className="num dim">{x.pa}</td>
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
