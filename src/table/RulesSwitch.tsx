import type { RulesVersion } from "../rules";

export function RulesSwitch({
  value,
  onChange,
}: {
  value: RulesVersion;
  onChange: (version: RulesVersion) => void;
}) {
  return (
    <label className="rules-switch" htmlFor="rules-version">
      规则
      <select
        id="rules-version"
        aria-label="规则"
        value={value}
        onChange={(event) => {
          const next = event.target.value;
          if (next === "v0.1" || next === "v0.3") onChange(next);
        }}
      >
        <option value="v0.1">经典</option>
        <option value="v0.3">暗牌</option>
      </select>
    </label>
  );
}
