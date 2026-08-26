import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ShieldAlert } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { listConversations, getConversationMessages } from "@/lib/ai/services/assistant-service";
import { EmptyState } from "@/components/shared/empty-state";
import { AssistantChat } from "@/components/ai/assistant-chat";

export default async function AiAssistantPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const t = await getTranslations("aiAssistantPage");

  if (!user.can("ai.assistant.use")) {
    return (
      <div className="flex flex-1 flex-col gap-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <EmptyState icon={ShieldAlert} title={t("restricted")} description={t("noPermission")} />
      </div>
    );
  }

  const sp = await searchParams;
  const requestedId = Array.isArray(sp.c) ? sp.c[0] : sp.c;

  const conversations = await listConversations(user.userId);
  const activeConversationId = requestedId && conversations.some((c) => c.id === requestedId) ? requestedId : conversations[0]?.id;
  const messages = activeConversationId ? await getConversationMessages(activeConversationId, user.userId) : [];

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-hidden">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <AssistantChat
        key={activeConversationId ?? "new"}
        conversations={conversations}
        activeConversationId={activeConversationId ?? null}
        initialMessages={messages}
      />
    </div>
  );
}
