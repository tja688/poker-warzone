import type { RoundResult } from "../game/engine";
const rankText = (n: number) =>
  ({ 11: "J", 12: "Q", 13: "K", 14: "A" })[n] || String(n);
/** One useful explanation on the table, including otherwise opaque kicker wins. */
export function resultText(result: RoundResult) {
  if (result.winner === "draw") return "牌型与点数相同，双方各得一胜";
  const win = result.grades[result.winner],
    lose = result.grades[result.winner === 0 ? 1 : 0];
  if (win.grade !== lose.grade) return `${win.name} 胜 ${lose.name}`;
  const i = win.ranks.findIndex((n, index) => n !== lose.ranks[index]);
  return `同为${win.name}，${rankText(win.ranks[i])} 大于 ${rankText(lose.ranks[i])}`;
}
