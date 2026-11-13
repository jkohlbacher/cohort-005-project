import { describeDraft, type NoteDraft } from "./lib/draft";

export type { NoteDraft };

/**
 * What the note editor shows for the text in the box: the character count
 * against the limit, and whether Save is allowed. It mirrors the rules the
 * save action enforces, so the Student finds out before they press Save.
 */
export function noteDraft(body: string): NoteDraft {
  return describeDraft(body);
}
