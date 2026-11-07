import type { CSSProperties } from "react";
import { motion } from "motion/react";
import { PlayingCard } from "../cards";
import type { Action } from "../game/engine";
export interface CardFlight {
  card: string;
  x: number;
  y: number;
  width: number;
  height: number;
  toX: number;
  toY: number;
}

/** Outgoing cards no longer exist on the next board. Capture their presentation
 * coordinates before committing, then render visual-only copies over the table.
 * This list is never saved and must never drive engine state. */
export function captureFlights(action: Action): CardFlight[] {
  const deck = document.querySelector(".deck-count")?.getBoundingClientRect();
  if (!deck || matchMedia("(prefers-reduced-motion: reduce)").matches)
    return [];
  return (action.kind === "discard" ? action.take : action.give).flatMap(
    (card) => {
      const element = document.querySelector(
        `.game-board [data-card="${card}"]:not(.ghost-card)`,
      );
      if (!element) return [];
      const r = element.getBoundingClientRect();
      return [
        {
          card,
          x: r.x,
          y: r.y,
          width: r.width,
          height: r.height,
          toX: deck.x + deck.width / 2 - r.width / 2,
          toY: deck.y + deck.height / 2 - r.height / 2,
        },
      ];
    },
  );
}
export function CardFlights({
  flights,
  onDone,
}: {
  flights: CardFlight[];
  onDone: () => void;
}) {
  return (
    <div className="card-flights" aria-hidden="true">
      {flights.map((f, i) => (
        <motion.div
          key={f.card}
          className="flying-card"
          style={
            {
              "--card-w": `${f.width}px`,
              "--card-h": `${f.height}px`,
            } as CSSProperties
          }
          initial={{ x: f.x, y: f.y, scale: 1, opacity: 1 }}
          animate={{ x: f.toX, y: f.toY, scale: 0.15, rotate: -16, opacity: 0 }}
          transition={{
            duration: 0.36,
            delay: i * 0.025,
            ease: [0.22, 1, 0.36, 1],
          }}
          onAnimationComplete={i === flights.length - 1 ? onDone : undefined}
        >
          <PlayingCard card={f.card} shared={false} />
        </motion.div>
      ))}
    </div>
  );
}
