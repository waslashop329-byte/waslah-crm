"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { MoreHorizontal, ExternalLink, StickyNote, Tag as TagIcon, CalendarPlus, MessageSquare, MessageCircleWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createNoteAction, addTagAction, createFollowUpAction, sendMessageAction, type ActionState } from "@/app/(dashboard)/customers/actions";
import { createComplaintAction } from "@/app/(dashboard)/complaints/actions";
import type { TagRow } from "@/lib/types/database";

const initialState: ActionState = {};

interface CustomerQuickActionsProps {
  customerId: string;
  tags: TagRow[];
  employees: { id: string; full_name: string }[];
}

export function CustomerQuickActions({ customerId, tags, employees }: CustomerQuickActionsProps) {
  const [openDialog, setOpenDialog] = useState<"note" | "tag" | "follow-up" | "message" | "complaint" | null>(null);
  const t = useTranslations("quickActions");

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/customers/${customerId}`}>
              <ExternalLink className="size-4" />
              {t("openProfile")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setOpenDialog("note")}>
            <StickyNote className="size-4" />
            {t("addNote")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setOpenDialog("tag")}>
            <TagIcon className="size-4" />
            {t("addTag")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setOpenDialog("follow-up")}>
            <CalendarPlus className="size-4" />
            {t("createFollowUp")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setOpenDialog("message")}>
            <MessageSquare className="size-4" />
            {t("sendMessage")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setOpenDialog("complaint")}>
            <MessageCircleWarning className="size-4" />
            {t("logComplaint")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AddNoteDialog open={openDialog === "note"} onOpenChange={(open) => setOpenDialog(open ? "note" : null)} customerId={customerId} />
      <AddTagDialog open={openDialog === "tag"} onOpenChange={(open) => setOpenDialog(open ? "tag" : null)} customerId={customerId} tags={tags} />
      <CreateFollowUpDialog
        open={openDialog === "follow-up"}
        onOpenChange={(open) => setOpenDialog(open ? "follow-up" : null)}
        customerId={customerId}
        employees={employees}
      />
      <SendMessageDialog open={openDialog === "message"} onOpenChange={(open) => setOpenDialog(open ? "message" : null)} customerId={customerId} />
      <LogComplaintDialog open={openDialog === "complaint"} onOpenChange={(open) => setOpenDialog(open ? "complaint" : null)} customerId={customerId} />
    </>
  );
}

function AddNoteDialog({ open, onOpenChange, customerId }: { open: boolean; onOpenChange: (open: boolean) => void; customerId: string }) {
  const [state, formAction, isPending] = useActionState(createNoteAction, initialState);
  const t = useTranslations("quickActions.note");

  useEffect(() => {
    if (state.success) {
      toast.success(t("save"));
      onOpenChange(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="customerId" value={customerId} />
          <Textarea name="content" placeholder={t("placeholder")} rows={4} required />
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? t("saving") : t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddTagDialog({
  open,
  onOpenChange,
  customerId,
  tags,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  tags: TagRow[];
}) {
  const [state, formAction, isPending] = useActionState(addTagAction, initialState);
  const t = useTranslations("quickActions.tag");

  useEffect(() => {
    if (state.success) {
      toast.success(t("add"));
      onOpenChange(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="customerId" value={customerId} />
          <div className="space-y-1.5">
            <Label htmlFor="tagId">{t("label")}</Label>
            <Select name="tagId" required>
              <SelectTrigger id="tagId" className="w-full">
                <SelectValue placeholder={t("placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {tags.map((tag) => (
                  <SelectItem key={tag.id} value={tag.id}>
                    {tag.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? t("adding") : t("add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CreateFollowUpDialog({
  open,
  onOpenChange,
  customerId,
  employees,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  employees: { id: string; full_name: string }[];
}) {
  const [state, formAction, isPending] = useActionState(createFollowUpAction, initialState);
  const t = useTranslations("quickActions.followUp");

  useEffect(() => {
    if (state.success) {
      toast.success(t("create"));
      onOpenChange(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="customerId" value={customerId} />

          <div className="space-y-1.5">
            <Label htmlFor="fu-title">{t("titleLabel")}</Label>
            <Input id="fu-title" name="title" placeholder={t("titlePlaceholder")} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="fu-type">{t("type")}</Label>
              <Select name="type" defaultValue="general">
                <SelectTrigger id="fu-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="call">{t("typeCall")}</SelectItem>
                  <SelectItem value="whatsapp">{t("typeWhatsapp")}</SelectItem>
                  <SelectItem value="general">{t("typeGeneral")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fu-priority">{t("priority")}</Label>
              <Select name="priority" defaultValue="medium">
                <SelectTrigger id="fu-priority" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">{t("priorityLow")}</SelectItem>
                  <SelectItem value="medium">{t("priorityMedium")}</SelectItem>
                  <SelectItem value="high">{t("priorityHigh")}</SelectItem>
                  <SelectItem value="urgent">{t("priorityUrgent")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="fu-due">{t("dueDate")}</Label>
              <Input id="fu-due" name="dueDate" type="datetime-local" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fu-assignee">{t("assignTo")}</Label>
              <Select name="assignedTo">
                <SelectTrigger id="fu-assignee" className="w-full">
                  <SelectValue placeholder={t("assignToPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fu-notes">{t("notes")}</Label>
            <Textarea id="fu-notes" name="notes" rows={3} placeholder={t("notesPlaceholder")} />
          </div>

          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? t("creating") : t("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SendMessageDialog({ open, onOpenChange, customerId }: { open: boolean; onOpenChange: (open: boolean) => void; customerId: string }) {
  const [state, formAction, isPending] = useActionState(sendMessageAction, initialState);
  const t = useTranslations("quickActions.message");

  useEffect(() => {
    if (state.success) {
      toast.success(t("send"));
      onOpenChange(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="customerId" value={customerId} />
          <div className="space-y-1.5">
            <Label htmlFor="msg-channel">{t("channel")}</Label>
            <Select name="channel" defaultValue="whatsapp">
              <SelectTrigger id="msg-channel" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="whatsapp">{t("channelWhatsapp")}</SelectItem>
                <SelectItem value="sms">{t("channelSms")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="msg-body">{t("body")}</Label>
            <Textarea id="msg-body" name="body" rows={4} placeholder={t("bodyPlaceholder")} required />
          </div>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? t("sending") : t("send")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LogComplaintDialog({ open, onOpenChange, customerId }: { open: boolean; onOpenChange: (open: boolean) => void; customerId: string }) {
  const [state, formAction, isPending] = useActionState(createComplaintAction, initialState);
  const t = useTranslations("quickActions.complaint");

  useEffect(() => {
    if (state.success) {
      toast.success(t("log"));
      onOpenChange(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="customerId" value={customerId} />
          <div className="space-y-1.5">
            <Label htmlFor="comp-type">{t("type")}</Label>
            <Select name="type" defaultValue="complaint">
              <SelectTrigger id="comp-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="complaint">{t("typeComplaint")}</SelectItem>
                <SelectItem value="inquiry">{t("typeInquiry")}</SelectItem>
                <SelectItem value="product_issue">{t("typeProductIssue")}</SelectItem>
                <SelectItem value="shipping_issue">{t("typeShippingIssue")}</SelectItem>
                <SelectItem value="refund_request">{t("typeRefundRequest")}</SelectItem>
                <SelectItem value="replacement_request">{t("typeReplacementRequest")}</SelectItem>
                <SelectItem value="warranty">{t("typeWarranty")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="comp-subject">{t("subject")}</Label>
            <Input id="comp-subject" name="subject" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="comp-description">{t("description")}</Label>
            <Textarea id="comp-description" name="description" rows={3} placeholder={t("descriptionPlaceholder")} />
          </div>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? t("logging") : t("log")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
