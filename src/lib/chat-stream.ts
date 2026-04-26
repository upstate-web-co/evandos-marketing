/**
 * Streaming chat client for UWC marketing site.
 * Parses Anthropic SSE events and calls onToken for each text chunk.
 */

export async function streamChat(
  messages: Array<{ role: string; content: string }>,
  opts: {
    agent?: string;
    onToken: (token: string) => void;
    onDone: (fullText: string) => void;
    onError: (msg: string) => void;
  }
) {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages,
        stream: true,
        agent: opts.agent,
      }),
    });

    // If non-streaming response (cached), handle normally
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const json = await res.json();
      const reply = json.data?.reply || json.reply || "";
      opts.onDone(reply);
      return;
    }

    if (!res.ok || !res.body) {
      opts.onError("Sorry, I had a hiccup. Email us at hello@upstate-web.com.");
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullText = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6);
        if (data === "[DONE]") continue;

        try {
          const event = JSON.parse(data);

          // Anthropic SSE: content_block_delta with text delta
          if (event.type === "content_block_delta" && event.delta?.text) {
            fullText += event.delta.text;
            opts.onToken(event.delta.text);
          }

          // message_stop means we're done
          if (event.type === "message_stop") {
            break;
          }
        } catch {
          // skip unparseable lines
        }
      }
    }

    opts.onDone(fullText);
  } catch {
    opts.onError("Something went wrong. Please try again or reach us at hello@upstate-web.com.");
  }
}
