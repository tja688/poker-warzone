import { Button } from "./components/ui/button";
import type { Card } from "./game/engine";
const suits: Record<string, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };
export function cardText(card: Card) {
  return `${card[0] === "T" ? "10" : card[0]}${suits[card[1]]}`;
}
export function PlayingCard({
  card,
  selected = false,
  disabled = false,
  onClick,
  small = false,
  ghost = false,
}: {
  card?: Card;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  small?: boolean;
  ghost?: boolean;
}) {
  if (!card)
    return (
      <div
        className={`playing-card empty-card ${small ? "small" : ""}`}
        aria-label="待吸入的牌位"
      >
        <span>+</span>
      </div>
    );
  const red = card[1] === "H" || card[1] === "D";
  const face = (
    <>
      <span className="card-corner">
        <b>{card[0] === "T" ? "10" : card[0]}</b>
        <span>{suits[card[1]]}</span>
      </span>
      <span className="card-suit" aria-hidden="true">
        {suits[card[1]]}
      </span>
      <span className="card-bottom" aria-hidden="true">
        {card[0] === "T" ? "10" : card[0]}
        {suits[card[1]]}
      </span>
      {selected && <span className="selected-dot" aria-hidden="true" />}
    </>
  );
  const classes = `playing-card ${red ? "red" : "black"} ${selected ? "selected" : ""} ${small ? "small" : ""} ${ghost ? "ghost-card" : ""}`;
  return onClick ? (
    <Button
      variant="ghost"
      className={classes}
      disabled={disabled}
      onClick={onClick}
      aria-pressed={selected}
      aria-label={`${cardText(card)}${selected ? " 已选" : ""}`}
    >
      {face}
    </Button>
  ) : (
    <div className={classes} aria-label={cardText(card)}>
      {face}
    </div>
  );
}
export function CardRow({
  cards,
  slots = false,
  selected = [],
  onSelect,
  disabled = false,
}: {
  cards: Card[];
  slots?: boolean;
  selected?: Card[];
  onSelect?: (c: Card) => void;
  disabled?: boolean;
}) {
  return (
    <div className="hand-row">
      {cards.map((c) => (
        <PlayingCard
          key={c}
          card={c}
          selected={selected.includes(c)}
          disabled={disabled}
          onClick={onSelect ? () => onSelect(c) : undefined}
        />
      ))}
      {slots &&
        Array.from({ length: Math.max(0, 5 - cards.length) }, (_, i) => (
          <PlayingCard key={`empty-${i}`} />
        ))}
    </div>
  );
}
