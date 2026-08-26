"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";
import { formatDistanceToNow } from "date-fns";
import { StickyNote, Trash2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { createNoteAction, type ActionState } from "@/app/(dashboard)/customers/actions";
import { deleteNoteAction } from "@/app/(dashboard)/customers/[customerId]/actions";
import { getDateFnsLocale } from "@/lib/date-locale";
import type { Locale } from "@/i18n/request";
import type { NoteWithAuthor } from "@/lib/repositories/customer-detail-repository";

const initialState: ActionState = {};

export function NotesTab({ customerId, notes, canDelete }: { customerId: string; notes: NoteWithAuthor[]; canDelete: boolean }) {
  const t = useTranslations("customerProfile.notes");
  const [state, formAction, isPending] = useActionState(createNoteAction, initialState);

  useEffect(() => {
    if (state.success) toast.success(t("noteAdded"));
    if (state.error) toast.error(state.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-2">
        <input type="hidden" name="customerId" value={customerId} />
        <Textarea name="content" placeholder={t("placeholder")} rows={3} required />
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? t("saving") : t("addNote")}
          </Button>
        </div>
      </form>

      {notes.length === 0 ? (
        <EmptyState icon={StickyNote} title={t("noNotesTitle")} description={t("noNotesDescription")} />
      ) : (
        <ul className="space-y-3">
          {notes.map((note) => (
            <NoteItem key={note.id} customerId={customerId} note={note} canDelete={canDelete} />
          ))}
        </ul>
      )}
    </div>
  );
}

function NoteItem({ customerId, note, canDelete }: { customerId: string; note: NoteWithAuthor; canDelete: boolean }) {
  const [state, formAction, isPending] = useActionState(deleteNoteAction, initialState);
  const locale = useLocale() as Locale;
  const dateLocale = getDateFnsLocale(locale);

  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <li className="rounded-md border p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{note.authorName}</p>
          <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(note.created_at), { addSuffix: true, locale: dateLocale })}</p>
        </div>
        {canDelete ? (
          <form action={formAction}>
            <input type="hidden" name="noteId" value={note.id} />
            <input type="hidden" name="customerId" value={customerId} />
            <Button type="submit" variant="ghost" size="icon" className="size-7" disabled={isPending}>
              <Trash2 className="size-3.5 text-muted-foreground" />
            </Button>
          </form>
        ) : null}
      </div>
      <p className="mt-1.5 whitespace-pre-wrap text-sm">{note.content}</p>
    </li>
  );
}
