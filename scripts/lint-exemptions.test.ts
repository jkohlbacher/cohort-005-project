import { describe, expect, it } from "vitest";
import { exemptions, grownExemptions } from "./lint-exemptions";

const config = (
  ...overrides: { files: string[]; rules: Record<string, unknown> }[]
) => ({
  overrides,
});

describe("exemptions", () => {
  it("lists the files each override switches a rule off for", () => {
    const result = exemptions(
      config(
        { files: ["a.ts", "b.ts"], rules: { "max-lines": "off" } },
        { files: ["c.ts"], rules: { "max-lines": "off", "max-depth": "off" } }
      )
    );
    expect(Object.fromEntries(result)).toEqual({
      "max-lines": ["a.ts", "b.ts", "c.ts"],
      "max-depth": ["c.ts"],
    });
  });

  it("counts 0 and an array starting with off as switched off", () => {
    const result = exemptions(
      config(
        { files: ["a.ts"], rules: { "max-lines": 0 } },
        { files: ["b.ts"], rules: { "max-depth": ["off", { max: 9 }] } }
      )
    );
    expect(Object.fromEntries(result)).toEqual({
      "max-lines": ["a.ts"],
      "max-depth": ["b.ts"],
    });
  });

  it("ignores overrides that keep a rule on", () => {
    const result = exemptions(
      config({ files: ["a.ts"], rules: { "max-lines": ["error", { max: 9 }] } })
    );
    expect(result.size).toBe(0);
  });

  it("reads a config with no overrides as no exemptions", () => {
    expect(exemptions({}).size).toBe(0);
  });
});

describe("grownExemptions", () => {
  const before = config({
    files: ["route.tsx"],
    rules: { "max-lines-per-function": "off" },
  });

  it("reports a rule whose list got longer, with the files added", () => {
    const after = config({
      files: ["route.tsx", "lesson-full.tsx"],
      rules: { "max-lines-per-function": "off" },
    });
    expect(grownExemptions(before, after)).toEqual([
      {
        rule: "max-lines-per-function",
        before: 1,
        after: 2,
        added: ["lesson-full.tsx"],
      },
    ]);
  });

  it("allows an exemption to move to a new file", () => {
    const after = config({
      files: ["lesson-full.tsx"],
      rules: { "max-lines-per-function": "off" },
    });
    expect(grownExemptions(before, after)).toEqual([]);
  });

  it("allows a list to shrink", () => {
    const after = config({
      files: [],
      rules: { "max-lines-per-function": "off" },
    });
    expect(grownExemptions(before, after)).toEqual([]);
  });

  it("reports a rule that had no exemptions before", () => {
    const after = config({ files: ["a.ts"], rules: { "max-depth": "off" } });
    expect(grownExemptions(before, after)).toEqual([
      { rule: "max-depth", before: 0, after: 1, added: ["a.ts"] },
    ]);
  });
});
