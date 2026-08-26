"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Bot, Loader2, MessageSquarePlus, Send, User, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { FeedbackButtons } from "@/components/ai/feedback-buttons";
import { sendAssistantMessageAction, type AssistantActionState } from "@/app/(dashboard)/ai-assistant/actions";
import { getDateFnsLocale } from "@/lib/date-locale";
import type { Locale } from "@/i18n/request";
import type { AiConversationRow, AiMessageRow } from "@/lib/types/database";
import { cn } from "@/lib/utils";

const SUGGESTION_KEYS = ["q1", "q2", "q3", "q4"];

const EMPTY_ACTION_STATE: AssistantActionState = {};

interface AssistantChatProps {
  conversations: AiConversationRow[];
  activeConversationId: string | null;
  initialMessages: AiMessageRow[];
}

// Keyed by conversationId at the call site (see page.tsx), so switching
// conversations remounts this component with fresh initial state instead of
// needing an effect to re-sync props into state.
export function AssistantChat({ conversations, activeConversationId, initialMessages }: AssistantChatProps) {
  const router = useRouter();
  const t = useTranslations("aiAssistantPage");
  const [conversationId, setConversationId] = useState<string | null>(activeConversationId);
  const [messages, setMessages] = useState<AiMessageRow[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [isPending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const optimisticIdCounterRef = useRef(0);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function submitText(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isPending) return;

    optimisticIdCounterRef.current += 1;
    const optimisticId = `optimistic-${optimisticIdCounterRef.current}`;
    const optimisticMessage: AiMessageRow = {
      id: optimisticId,
      conversation_id: conversationId ?? "pending",
      role: "user",
      content: trimmed,
      tool_calls: null,
      created_at: new Date(0).toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMessage]);
    setDraft("");

    startTransition(async () => {
      const formData = new FormData();
      if (conversationId) formData.set("conversationId", conversationId);
      formData.set("message", trimmed);

      const result = await sendAssistantMessageAction(EMPTY_ACTION_STATE, formData);

      if (result.error || !result.userMessage || !result.assistantMessage) {
        toast.error(result.error ?? t("failedResponse"));
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        return;
      }

      setMessages((prev) => [...prev.filter((m) => m.id !== optimisticId), result.userMessage!, result.assistantMessage!]);
      setConversationId(result.conversationId ?? null);
      router.refresh();
    });
  }

  return (
    <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden md:grid-cols-[240px_1fr]">
      <div className="flex flex-col gap-2 overflow-hidden">
        <Button asChild variant="outline" size="sm" className="justify-start gap-1.5">
          <Link href="/ai-assistant">
            <MessageSquarePlus className="size-3.5" />
            {t("newChat")}
          </Link>
        </Button>
        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-1 pr-2">
            {conversations.length === 0 ? (
              <p className="px-2 py-4 text-xs text-muted-foreground">{t("noConversations")}</p>
            ) : (
              conversations.map((c) => (
                <Link
                  key={c.id}
                  href={`/ai-assistant?c=${c.id}`}
                  className={cn(
                    "truncate rounded-md px-2 py-1.5 text-sm hover:bg-muted",
                    c.id === conversationId ? "bg-muted font-medium" : "text-muted-foreground",
                  )}
                >
                  {c.title ?? t("newConversation")}
                </Link>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="flex flex-col overflow-hidden rounded-lg border">
        <ScrollArea className="flex-1 p-4">
          <div className="flex flex-col gap-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-10 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                  <Bot className="size-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">{t("askTitle")}</p>
                  <p className="mx-auto max-w-sm text-sm text-muted-foreground">{t("askSubtitle")}</p>
                </div>
                <div className="flex max-w-md flex-wrap justify-center gap-2">
                  {SUGGESTION_KEYS.map((key) => {
                    const question = t(`suggestions.${key}`);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => submitText(question)}
                        className="rounded-full border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
                      >
                        {question}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
                {isPending ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" />
                    {t("thinking")}
                  </div>
                ) : null}
              </>
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        <form
          className="flex items-end gap-2 border-t p-3"
          onSubmit={(e) => {
            e.preventDefault();
            submitText(draft);
          }}
        >
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submitText(draft);
              }
            }}
            placeholder={t("inputPlaceholder")}
            rows={1}
            className="min-h-9 flex-1 resize-none"
            disabled={isPending}
          />
          <Button type="submit" size="icon" disabled={isPending || !draft.trim()}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
}

interface ToolCallTrace {
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
  error?: string;
}

function MessageBubble({ message }: { message: AiMessageRow }) {
  const t = useTranslations("aiAssistantPage");
  const locale = useLocale() as Locale;
  const dateLocale = getDateFnsLocale(locale);
  const isUser = message.role === "user";
  const isOptimistic = message.id.startsWith("optimistic-");
  const tools = Array.isArray(message.tool_calls) ? (message.tool_calls as unknown as ToolCallTrace[]) : [];

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div className={cn("flex size-7 shrink-0 items-center justify-center rounded-full", isUser ? "bg-primary text-primary-foreground" : "bg-muted")}>
        {isUser ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
      </div>
      <div className={cn("flex max-w-[75%] flex-col gap-1.5", isUser && "items-end")}>
        <div className={cn("rounded-lg px-3 py-2 text-sm whitespace-pre-wrap", isUser ? "bg-primary text-primary-foreground" : "bg-muted")}>
          {message.content}
        </div>
        {tools.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {tools.map((tool, i) => (
              <Badge key={`${tool.name}-${i}`} variant="outline" className="gap-1 text-[10px] text-muted-foreground">
                <Wrench className="size-2.5" />
                {tool.name}
              </Badge>
            ))}
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          <p className="text-[10px] text-muted-foreground">
            {isOptimistic ? t("sending") : formatDistanceToNow(new Date(message.created_at), { addSuffix: true, locale: dateLocale })}
          </p>
          {!isUser && !isOptimistic ? <FeedbackButtons outputType="assistant_message" outputId={message.id} /> : null}
        </div>
      </div>
    </div>
  );
}
