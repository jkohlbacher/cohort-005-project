import { describe, it, expect } from "vitest";
import { noteDraft } from "../index";

describe("noteDraft", () => {
  it("allows saving a note with text in it", () => {
    expect(noteDraft("Generics clicked at 4:10")).toEqual({
      length: 24,
      maxLength: 2000,
      empty: false,
      tooLong: false,
      canSave: true,
    });
  });

  it("does not allow saving an empty note", () => {
    const draft = noteDraft("");
    expect(draft.empty).toBe(true);
    expect(draft.canSave).toBe(false);
  });

  it("treats a note of only whitespace as empty", () => {
    const draft = noteDraft("  \n\t ");
    expect(draft.empty).toBe(true);
    expect(draft.canSave).toBe(false);
    expect(draft.length).toBe(0);
  });

  it("does not count surrounding whitespace against the maximum", () => {
    const draft = noteDraft(`  ${"a".repeat(2000)}\n`);
    expect(draft.length).toBe(2000);
    expect(draft.tooLong).toBe(false);
    expect(draft.canSave).toBe(true);
  });

  it("allows a note of exactly the maximum length", () => {
    const draft = noteDraft("a".repeat(2000));
    expect(draft.tooLong).toBe(false);
    expect(draft.canSave).toBe(true);
  });

  it("does not allow saving a note one character over the maximum", () => {
    const draft = noteDraft("a".repeat(2001));
    expect(draft.tooLong).toBe(true);
    expect(draft.empty).toBe(false);
    expect(draft.canSave).toBe(false);
  });
});
