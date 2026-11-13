import { MAX_NOTE_LENGTH } from "~/lib/notes";

export type NoteDraft = {
  length: number;
  maxLength: number;
  empty: boolean;
  tooLong: boolean;
  canSave: boolean;
};

export function describeDraft(body: string): NoteDraft {
  const empty = body.trim().length === 0;
  const tooLong = body.length > MAX_NOTE_LENGTH;
  return {
    length: body.length,
    maxLength: MAX_NOTE_LENGTH,
    empty,
    tooLong,
    canSave: !empty && !tooLong,
  };
}
