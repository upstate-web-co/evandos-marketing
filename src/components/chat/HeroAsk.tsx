import { useState, useRef, useEffect } from "react";
import { streamChat } from "../../lib/chat-stream";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "What do you build?",
  "How much does a website cost?",
  "I need an online store",
  "Tell me about custom apps",
];

export default function HeroAsk() {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const scrollYRef = useRef(0);

  // Scroll only the chat container, and restore page scroll if it shifted
  useEffect(() => {
    const el = chatContainerRef.current;
    if (el && messages.length > 0) el.scrollTop = el.scrollHeight;
    // Restore page scroll position to prevent viewport jumping
    if (scrollYRef.current > 0) {
      window.scrollTo(0, scrollYRef.current);
    }
  }, [messages]);

  const ask = async (text: string) => {
    if (!text.trim() || loading) return;
    // Capture scroll position before any state changes
    scrollYRef.current = window.scrollY;
    setQuery("");
    const userMsg: Message = { role: "user", content: text.trim() };
    const history = [...messages, userMsg];
    setMessages(history);
    setLoading(true);

    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    await streamChat(
      history.map((m) => ({ role: m.role, content: m.content })),
      {
        onToken: (token) => {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last?.role === "assistant") {
              updated[updated.length - 1] = { ...last, content: last.content + token };
            }
            return updated;
          });
        },
        onDone: (fullText) => {
          if (fullText) {
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = { role: "assistant", content: fullText };
              return updated;
            });
          }
          setLoading(false);
        },
        onError: (msg) => {
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: "assistant", content: msg };
            return updated;
          });
          setLoading(false);
        },
      }
    );
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="w-full max-w-2xl mx-auto mt-10">
      {/* Search Input */}
      <form
        ref={formRef}
        onSubmit={(e) => { e.preventDefault(); ask(query); }}
        className="relative"
      >
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask about our services, pricing, or process..."
          className="w-full px-6 py-4 bg-[#1A1814]/5 border border-[#1A1814]/15 rounded-2xl text-[#1A1814] placeholder-[#1A1814]/40 text-lg focus:outline-none focus:border-[#B85C38]/50 focus:bg-white transition-all"
        />
        <button
          type="submit"
          disabled={!query.trim() || loading}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 bg-[#B85C38] text-white rounded-xl hover:bg-[#a04e2f] transition-colors disabled:opacity-40"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
          </svg>
        </button>
      </form>

      {/* Suggestion Pills — hide once conversation starts */}
      {!hasMessages && (
        <div className="flex flex-wrap gap-2 mt-4">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => ask(s)}
              className="px-4 py-2 bg-[#1A1814]/5 border border-[#1A1814]/10 text-[#1A1814]/60 text-sm rounded-full hover:border-[#B85C38]/40 hover:text-[#B85C38] transition-all"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Conversation — always rendered, height transitions smoothly */}
      <div
        ref={chatContainerRef}
        className={`mt-4 bg-white border border-[#1A1814]/10 rounded-2xl p-4 overflow-y-auto space-y-3 shadow-sm transition-all duration-300 ${
          hasMessages ? "max-h-80 opacity-100" : "max-h-0 p-0 border-0 opacity-0 overflow-hidden"
        }`}
      >
        {messages.filter((m) => m.content).map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-[#B85C38] text-white rounded-br-sm"
                  : "bg-[#1A1814]/5 text-[#1A1814] rounded-bl-sm"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && messages[messages.length - 1]?.content === "" && (
          <div className="flex justify-start">
            <div className="px-4 py-3 bg-[#1A1814]/5 rounded-2xl rounded-bl-sm">
              <span className="flex gap-1.5">
                <span className="w-2 h-2 bg-[#1A1814]/30 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-[#1A1814]/30 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-[#1A1814]/30 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Save conversation */}
      {messages.filter((m) => m.content).length > 1 && (
        <div className="mt-2 text-right">
          <button
            onClick={() => {
              const text = messages
                .filter((m) => m.content)
                .map((m) => `${m.role === "user" ? "You" : "UWC"}: ${m.content}`)
                .join("\n\n");
              const blob = new Blob([text], { type: "text/plain" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = "uwc-conversation.txt";
              a.click();
            }}
            className="text-xs text-[#1A1814]/30 hover:text-[#B85C38] transition-colors"
          >
            Save conversation
          </button>
        </div>
      )}
    </div>
  );
}
