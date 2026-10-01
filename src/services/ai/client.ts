import type { ChatMessage, StudioSettings } from "../../types/studio";

type CompletionOptions = {
  messages: ChatMessage[];
  settings: StudioSettings;
  signal: AbortSignal;
  onToken: (token: string) => void;
};

export async function streamChatCompletion({ messages, settings, signal, onToken }: CompletionOptions) {
  const response = await fetch(`${settings.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: settings.model,
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
      stream: settings.streaming,
      messages: [
        { role: "system", content: settings.systemPrompt },
        ...messages.map(({ role, content, files }) => {
          if (!files?.length) return { role, content };
          const parts: { type: string; text?: string; image_url?: { url: string } }[] = [{ type: "text", text: content }];
          for (const file of files) {
            if (file.type.startsWith("image/") && file.previewUrl) parts.push({ type: "image_url", image_url: { url: file.previewUrl } });
            else if (file.content) parts.push({ type: "text", text: `\n\n--- ${file.name} ---\n${file.content}` });
          }
          return { role, content: parts };
        }),
      ],
    }),
  });

  if (!response.ok) throw new Error(`LM Studio antwortet mit ${response.status}`);
  if (!settings.streaming) {
    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;
    if (typeof content === "string") onToken(content);
    return;
  }
  if (!response.body) throw new Error("Die Antwort enthält keinen Streaming-Body.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n");
    buffer = events.pop() ?? "";
    for (const event of events) {
      const data = event.trim().replace(/^data:\s*/, "");
      if (!data || data === "[DONE]") continue;
      try {
        const token = JSON.parse(data).choices?.[0]?.delta?.content;
        if (token) onToken(token);
      } catch {
        continue;
      }
    }
  }
}

export async function checkLmStudio(baseUrl: string, signal?: AbortSignal) {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/models`, { signal });
  if (!response.ok) throw new Error(`Verbindung fehlgeschlagen (${response.status})`);
  const result = await response.json();
  return (result.data ?? []).map((item: { id: string }) => item.id) as string[];
}