import { useMemo, useState } from "react";
import { getContract, getPlayerCurrent, getPlayerState, happinessReasons, interactWithPlayer, releasePlayer, renewContract, sellPlayer, setTraining } from "../game/career";
import { nationFlag } from "../game/nations";
import { formatMoney } from "../game/format";
import type { CareerState } from "../game/types";
import { sortBy, useSort } from "../hooks/useSort";
import { PlayerPanel } from "./PlayerPanel";
import { AbilityStars, RatingDots, SortHeader } from "./ui";

const CAT_ORDER: Record<string, number> = { GK: 0, DF: 1, MF: 2, FW: 3 };

interface Props {
  career: CareerState;
  apply: (next: CareerState) => void;
}

export function SquadView({ career, apply }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const { sort, toggle } = useSort("ca");

  const squad = useMemo(() => {
    const ids = career.squads[career.userClubId] ?? [];
    const list = ids.map((id) => ({ id, p: getPlayerCurrent(career, id), st: getPlayerState(career, id) }));
    return sortBy(list, sort, (x, key) => {
      switch (key) {
        case "name": return x.p.name.toLowerCase();
        case "nation": return x.p.nation ?? "";
        case "position": return `${CAT_ORDER[x.p.category]}-${x.p.position}`;
        case "ca": return x.p.ca;
        case "condition": return x.st.condition;
        case "form": return x.st.form.length ? x.st.form[x.st.form.length - 1] : 0;
        case "age": return x.p.age;
        default: return x.p.ca;
      }
    });
  }, [career, sort]);

  const selectedPlayer = selected != null ? getPlayerCurrent(career, selected) : null;
  const selectedState = selected != null ? getPlayerState(career, selected) : null;

  const doSell = (id: number) => {
    const out = sellPlayer(career, id);
    if (out.ok) { apply(out.state); setSelected(null); setFeedback(out.message); }
    else setFeedback(out.message);
  };
  const doRelease = (id: number) => {
    const out = releasePlayer(career, id);
    if (out.ok) { apply(out.state); setSelected(null); setFeedback(out.message); }
  };

  return (
    <div>
      {feedback && (
        <div className="banner">
          <div className="msg">{feedback}</div>
          <button className="btn small" onClick={() => setFeedback(null)}>OK</button>
        </div>
      )}

      <div className="panel">
        <div className="panel-title">Squad ({squad.length})</div>
        <table className="table">
          <thead>
            <tr>
              <SortHeader label="Name" sortKey="name" sort={sort} onSort={toggle} />
              <SortHeader label="Nat" sortKey="nation" sort={sort} onSort={toggle} />
              <SortHeader label="Pos" sortKey="position" sort={sort} onSort={toggle} />
              <SortHeader label="Ability" sortKey="ca" sort={sort} onSort={toggle} />
              <SortHeader label="Cond" sortKey="condition" sort={sort} onSort={toggle} num />
              <SortHeader label="Form" sortKey="form" sort={sort} onSort={toggle} />
              <SortHeader label="Age" sortKey="age" sort={sort} onSort={toggle} num />
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {squad.map(({ id, p, st }) => (
              <tr key={id} className="row-click" onClick={() => setSelected(id)}>
                <td>{p.name}</td>
                <td title={p.nation ?? ""}>{nationFlag(p.nation) ?? "—"}</td>
                <td>{p.position}</td>
                <td><AbilityStars ca={p.ca} pa={p.pa} /></td>
                <td className={`num ${st.condition < 70 ? "cond-low" : "dim"}`}>{Math.round(st.condition)}</td>
                <td><RatingDots form={st.form} /></td>
                <td className="num">{p.age}</td>
                <td className="muted">
                  {st.injured || st.injuryDaysLeft > 0
                    ? `Injured ${st.injuryDaysLeft}d`
                    : st.suspended > 0
                      ? `Suspended ${st.suspended}m`
                      : st.wantsTransfer
                        ? "Wants out"
                        : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedPlayer && selected != null && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <PlayerPanel
              player={selectedPlayer}
              state={selectedState ?? undefined}
              onSetTraining={(focus) => apply(setTraining(career, selected, focus))}
              contract={getContract(career, selected)}
              seasonYear={career.seasonStartYear}
              onRenew={() => {
                const out = renewContract(career, selected);
                apply(out.state);
                setFeedback(out.message);
              }}
              happiness={happinessReasons(career, selected)}
              onInteract={(kind) => {
                const out = interactWithPlayer(career, selected, kind);
                apply(out.state);
                setFeedback(out.message);
              }}
            />
            <div className="btn-row" style={{ marginTop: 16 }}>
              <button className="btn" onClick={() => doSell(selected)}>Sell ({formatMoney(Math.round(selectedPlayer.value * 0.85))})</button>
              <button className="btn danger" onClick={() => doRelease(selected)}>Release</button>
              <div className="spacer" style={{ flex: 1 }} />
              <button className="btn small" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
