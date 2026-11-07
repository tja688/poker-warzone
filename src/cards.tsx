import { motion, useReducedMotion } from "motion/react";
import { Button } from "./components/ui/button";
import type { Card } from "./game/engine";
const suits: Record<string, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };
export const cardText = (card: Card) =>
  `${card[0] === "T" ? "10" : card[0]}${suits[card[1]]}`;
const CardButton = motion.create(Button);
/** Shared identity follows a card from reserve to battle. Preview/inspection
 * copies opt out, otherwise Motion would animate to a duplicate destination. */
export function PlayingCard({
  card,
  selected = false,
  disabled = false,
  onClick,
  small = false,
  ghost = false,
  shared = true,
}: {
  card?: Card;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  small?: boolean;
  ghost?: boolean;
  shared?: boolean;
}) {
  const reduce = useReducedMotion();
  if (!card)
    return (
      <div
        className={`playing-card empty-card ${small ? "small" : ""}`}
        aria-hidden="true"
      >
        <span>♠</span>
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
        {cardText(card)}
      </span>
    </>
  );
  const props = {
    className: `playing-card ${red ? "red" : "black"} ${selected ? "selected" : ""} ${small ? "small" : ""} ${ghost ? "ghost-card" : ""}`,
    layoutId: shared && !ghost && !reduce ? `card-${card}` : undefined,
    "data-card": card,
    initial: reduce ? (false as const) : { opacity: 0.6, scale: 0.92 },
    animate: { opacity: ghost ? 0.48 : 1, scale: 1, y: selected ? -9 : 0 },
    transition: { type: "spring" as const, stiffness: 440, damping: 32 },
    style: { borderRadius: "7px" },
  };
  return onClick ? (
    <CardButton
      {...props}
      variant="ghost"
      disabled={disabled}
      onClick={onClick}
      whileHover={reduce ? undefined : { y: -9 }}
      whileTap={reduce ? undefined : { scale: 0.96 }}
      aria-pressed={selected}
      aria-label={`${cardText(card)}${selected ? " 已选" : ""}`}
    >
      {face}
    </CardButton>
  ) : (
    <motion.div {...props} aria-label={cardText(card)}>
      {face}
    </motion.div>
  );
}
export function CardRow({
  cards,
  slots = false,
  selected = [],
  onSelect,
  disabled = false,
  shared = true,
}: {
  cards: Card[];
  slots?: boolean;
  selected?: Card[];
  onSelect?: (c: Card) => void;
  disabled?: boolean;
  shared?: boolean;
}) {
  return (
    <div className="hand-row">
      {cards.map((c) => (
        <PlayingCard
          key={c}
          card={c}
          selected={selected.includes(c)}
          disabled={disabled}
          shared={shared}
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
