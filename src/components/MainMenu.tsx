interface Props {
  hasSave: boolean;
  onContinue: () => void;
  onNewGame: () => void;
}

export function MainMenu({ hasSave, onContinue, onNewGame }: Props) {
  return (
    <div className="menu-wrap">
      <div className="menu-box">
        <h1>Football <span>Manager</span></h1>
        <div className="sub">A modern take on the classic 2012 manager experience</div>
        {hasSave && (
          <button className="btn primary" onClick={onContinue}>
            Continue Career
          </button>
        )}
        <button className="btn" onClick={onNewGame}>
          {hasSave ? "Start New Career" : "Start Career"}
        </button>
        <div className="muted small" style={{ marginTop: 24 }}>
          Real players &amp; clubs from EA Sports FC 25 data · 6 leagues · 120 clubs
        </div>
      </div>
    </div>
  );
}
