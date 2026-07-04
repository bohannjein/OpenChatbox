import { useCallback } from "react";
import { useStore } from "@/lib/store";
import { generateTitle, parseModelKey } from "@/lib/providers";

/**
 * Auto-title hook. After the FIRST assistant answer completes, fire a hidden
 * background request that asks the model for a concise (<=4 word) title and
 * updates the chat title live. Fire-and-forget; safe to call after every
 * generation — it self-gates to the first exchange of non-temporary chats.
 */
export function useAutoTitle() {
  const providers = useStore((s) => s.providers);
  const selectedModelKey = useStore((s) => s.selectedModelKey);
  const titleModelKey = useStore((s) => s.routerModels.title);
  const sidekicks = useStore((s) => s.sidekicks);
  const renameChat = useStore((s) => s.renameChat);
  const setTitlePending = useStore((s) => s.setTitlePending);

  return useCallback(
    async (chatId: string) => {
      const chat = useStore.getState().chats.find((c) => c.id === chatId);
      if (!chat || chat.temporary) return;

      // Only after the very first complete answer (1 non-empty assistant msg).
      const answers = chat.messages.filter(
        (m) => m.role === "assistant" && m.content.trim()
      );
      const firstUser = chat.messages.find((m) => m.role === "user");
      if (answers.length !== 1 || !firstUser) return;

      // Effective model: a sidekick wins; else the dedicated thread-naming
      // model (Standardmodelle → Thread-Benennung); else the current selection.
      const sk = chat.sidekickId
        ? sidekicks.find((x) => x.id === chat.sidekickId)
        : undefined;
      const key = sk?.modelKey || titleModelKey || selectedModelKey;
      if (!key) return;
      const { providerId, model } = parseModelKey(key);
      const provider = providers.find((p) => p.id === providerId);
      if (!provider) return;

      const transcript = `Nutzer: ${firstUser.content}\n\nKI: ${answers[0].content}`
        .slice(0, 2000);

      setTitlePending(chatId); // → sidebar shows the ASCII loader
      try {
        const title = await generateTitle(
          {
            type: provider.type,
            baseUrl: provider.baseUrl,
            apiKey: provider.apiKey,
            providerId: provider.id,
            model,
          },
          transcript
        );
        // Re-check the chat still exists and wasn't renamed by the user meanwhile.
        if (title && useStore.getState().chats.some((c) => c.id === chatId)) {
          renameChat(chatId, title);
        }
      } catch {
        /* ignore — keep the provisional title */
      } finally {
        setTitlePending(null);
      }
    },
    [providers, selectedModelKey, sidekicks, renameChat, setTitlePending]
  );
}
