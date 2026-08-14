import { useState } from "react";
import { ClubSelect } from "./components/ClubSelect";
import { GameScreen } from "./components/GameScreen";
import { MainMenu } from "./components/MainMenu";
import { clearSave, loadCareer, newCareer, saveCareer } from "./game/career";
import type { CareerState } from "./game/types";

type Screen = "menu" | "select" | "game";

export default function App() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [career, setCareer] = useState<CareerState | null>(() => loadCareer());

  const apply = (next: CareerState) => {
    setCareer(next);
    saveCareer(next);
  };

  if (screen === "game" && career) {
    return (
      <GameScreen
        career={career}
        apply={apply}
        onExit={() => setScreen("menu")}
      />
    );
  }

  if (screen === "select") {
    return (
      <ClubSelect
        onBack={() => setScreen("menu")}
        onPick={(clubId, name) => {
          apply(newCareer(clubId, name));
          setScreen("game");
        }}
      />
    );
  }

  return (
    <MainMenu
      hasSave={career != null}
      onContinue={() => setScreen("game")}
      onNewGame={() => {
        clearSave();
        setCareer(null);
        setScreen("select");
      }}
    />
  );
}
