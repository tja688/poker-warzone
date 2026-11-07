export type RulesVersion = "v0.1" | "v0.3";
export const RULES_KEY = "poker-warzone-rules";

export function writeRules(version: RulesVersion) {
  try {
    localStorage.setItem(RULES_KEY, version);
  } catch {
    /* The table still follows the in-memory choice. */
  }
}

/** Query wins, then the saved choice, then the dark-card table. Lab never calls this. */
export function readRules(search = location.search): RulesVersion {
  const query = new URLSearchParams(search).get("rules");
  if (query === "v0.1" || query === "v0.3") {
    writeRules(query);
    return query;
  }
  try {
    const saved = localStorage.getItem(RULES_KEY);
    if (saved === "v0.1" || saved === "v0.3") return saved;
  } catch {
    /* No storage still opens the default table. */
  }
  return "v0.3";
}
