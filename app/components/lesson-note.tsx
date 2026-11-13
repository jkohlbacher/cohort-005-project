import { useState } from "react";
import { useFetcher } from "react-router";
import { Lock, NotebookPen } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Textarea } from "~/components/ui/textarea";
import { cn, formatRelativeTime } from "~/lib/utils";
import { noteDraft, type NoteDraft } from "~/modules/lesson-notes";

/**
 * The Student's private note on a lesson. Styled as a sibling of the
 * Questions & Discussion card, so the two read as one family on the page.
 */
export function LessonNote({
  note,
}: {
  note: { body: string; updatedAt: string } | null;
}) {
  const fetcher = useFetcher<{ ok: boolean; error?: string }>();
  const [body, setBody] = useState(note?.body ?? "");
  const isSaving = fetcher.state !== "idle";
  const error = fetcher.data?.error;
  const draft = noteDraft(body);

  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <LessonNoteHeader />

        <fetcher.Form method="post" className="space-y-2">
          <input type="hidden" name="intent" value="save-note" />
          <Textarea
            name="body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="What stood out? What do you want to try later?"
            aria-label="Your notes"
            className="min-h-32 resize-y"
          />
          <LessonNoteFooter
            isSaving={isSaving}
            draft={draft}
            error={error}
            updatedAt={note?.updatedAt}
          />
        </fetcher.Form>
      </CardContent>
    </Card>
  );
}

function LessonNoteHeader() {
  return (
    <>
      <div className="mb-1 flex items-center gap-2">
        <NotebookPen className="size-5 text-primary" />
        <h2 className="text-xl font-semibold">Your notes</h2>
        <span className="ml-auto flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          <Lock className="size-3" />
          Private
        </span>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Only you can read these. Jot down anything worth remembering from this
        lesson.
      </p>
    </>
  );
}

function LessonNoteFooter({
  isSaving,
  draft,
  error,
  updatedAt,
}: {
  isSaving: boolean;
  draft: NoteDraft;
  error: string | undefined;
  updatedAt: string | undefined;
}) {
  return (
    <div className="flex items-center gap-3">
      <Button type="submit" size="sm" disabled={isSaving || !draft.canSave}>
        {isSaving ? "Saving..." : "Save note"}
      </Button>
      {error ? (
        <span className="text-sm text-destructive">{error}</span>
      ) : (
        updatedAt && (
          <span
            suppressHydrationWarning
            className="text-xs text-muted-foreground"
          >
            Last edited {formatRelativeTime(updatedAt)}
          </span>
        )
      )}
      <span
        className={cn(
          "ml-auto text-xs",
          draft.tooLong ? "text-destructive" : "text-muted-foreground"
        )}
      >
        {draft.length} / {draft.maxLength}
      </span>
    </div>
  );
}
