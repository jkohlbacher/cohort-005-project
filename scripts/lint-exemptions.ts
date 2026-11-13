// The exemption lists in .oxlintrc.json are a ratchet: each one names files
// that already broke a rule when the rule arrived, and it may only shrink.
// These functions find where a change made one longer.

type OxlintConfig = {
  overrides?: { files?: string[]; rules?: Record<string, unknown> }[];
};

export type GrownExemption = {
  rule: string;
  before: number;
  after: number;
  added: string[];
};

const isOff = (setting: unknown) => {
  const level = Array.isArray(setting) ? setting[0] : setting;
  return level === "off" || level === 0;
};

/** For each rule, the files the config's overrides switch it off for. */
export function exemptions(config: OxlintConfig): Map<string, string[]> {
  const byRule = new Map<string, string[]>();
  for (const override of config.overrides ?? []) {
    for (const [rule, setting] of Object.entries(override.rules ?? {})) {
      if (!isOff(setting)) continue;
      const files = byRule.get(rule) ?? [];
      files.push(...(override.files ?? []));
      byRule.set(rule, files);
    }
  }
  return byRule;
}

/** Every rule whose exemption list is longer in `after` than in `before`. */
export function grownExemptions(
  before: OxlintConfig,
  after: OxlintConfig
): GrownExemption[] {
  const was = exemptions(before);
  return [...exemptions(after)]
    .map(([rule, files]) => {
      const previous = was.get(rule) ?? [];
      return {
        rule,
        before: previous.length,
        after: files.length,
        added: files.filter((file) => !previous.includes(file)),
      };
    })
    .filter(({ before, after }) => after > before);
}
