import { MAX_NOTE_LENGTH } from "~/lib/notes";

export type NoteDraft = {
  length: number;
  maxLength: number;
  empty: boolean;
  tooLong: boolean;
  canSave: boolean;
};

export function describeDraft(body: string): NoteDraft {
  // The save action trims before it checks, so the draft is measured trimmed.
  const length = body.trim().length;
  const empty = length === 0;
  const tooLong = length > MAX_NOTE_LENGTH;
  return {
    length,
    maxLength: MAX_NOTE_LENGTH,
    empty,
    tooLong,
    canSave: !empty && !tooLong,
  };
}
