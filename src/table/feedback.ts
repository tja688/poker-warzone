// One context, unlocked by a real gesture. Audio never touches the rules layer.
let context: AudioContext | undefined;
export type Cue = "pick" | "play" | "win" | "lose" | "raise" | "knockout";
export function playCue(cue: Cue, enabled: boolean) {
  if (!enabled) return;
  try {
    context ??= new AudioContext();
    void context.resume().catch(() => {});
    const notes =
      cue === "knockout"
        ? [523, 659, 784, 1046]
        : cue === "win"
          ? [440, 554, 660]
          : cue === "raise"
            ? [349, 440, 587]
            : cue === "lose"
              ? [330, 247]
              : cue === "play"
                ? [220, 330]
                : [520];
    notes.forEach((frequency, i) => {
      const osc = context!.createOscillator(),
        gain = context!.createGain();
      const start = context!.currentTime + i * 0.065;
      osc.type = "sine";
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.045, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.14);
      osc.connect(gain);
      gain.connect(context!.destination);
      osc.start(start);
      osc.stop(start + 0.15);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    });
  } catch {
    /* Blocked audio cannot block a move. */
  }
}
export const TIMING = { aiThink: 780, settle: 480, reveal: 420 } as const;
