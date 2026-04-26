import { useState, useRef, useEffect } from "react";
import { streamChat } from "../../lib/chat-stream";

interface Props {
  title?: string;
  subtitle?: string;
  suggestions?: string[];
  agent?: "default" | "public";
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function InlineChat({
  title = "Have a question?",
  subtitle = "Ask about our services, pricing, or process",
  suggestions = ["How long does a project take?", "What's included in the price?", "Do you build apps?"],
  agent = "default",
}: Props) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const scrollYRef = useRef(0);

  useEffect(() => {
    const el = chatContainerRef.current;
    if (el && messages.length > 0) el.scrollTop = el.scrollHeight;
    if (scrollYRef.current > 0) {
      window.scrollTo(0, scrollYRef.current);
    }
  }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    scrollYRef.current = window.scrollY;
    setInput("");
    const userMsg: Message = { role: "user", content: text.trim() };
    const history = [...messages, userMsg];
    setMessages(history);
    setLoading(true);

    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    await streamChat(
      history.map((m) => ({ role: m.role, content: m.content })),
      {
        agent,
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
    return;
  };

  return (
    <div className="bg-[#1A1814]/5 border border-[#1A1814]/10 rounded-2xl p-6 md:p-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-[#B85C38]/10 rounded-full flex items-center justify-center flex-shrink-0">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#B85C38]">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-[#1A1814]">{title}</h3>
          <p className="text-xs text-[#1A1814]/50">{subtitle}</p>
        </div>
        {messages.filter((m) => m.content).length > 0 && (
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
            className="p-2 text-[#1A1814]/30 hover:text-[#B85C38] transition-colors"
            title="Save conversation"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
          </button>
        )}
      </div>

      {/* Suggestion Pills */}
      {messages.length === 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="px-3.5 py-1.5 bg-white border border-[#1A1814]/10 text-[#1A1814]/60 text-sm rounded-full hover:border-[#B85C38]/40 hover:text-[#B85C38] transition-all"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Messages — always rendered, expands smoothly */}
      <div
        ref={chatContainerRef}
        className={`overflow-y-auto space-y-3 pr-1 transition-all duration-300 ${
          messages.length > 0 ? "max-h-64 mb-4" : "max-h-0 overflow-hidden"
        }`}
      >
          {messages.filter((m) => m.content).map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-[#B85C38] text-white rounded-br-sm"
                    : "bg-white text-[#1A1814] border border-[#1A1814]/10 rounded-bl-sm"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {loading && messages[messages.length - 1]?.content === "" && (
            <div className="flex justify-start">
              <div className="px-4 py-3 bg-white border border-[#1A1814]/10 rounded-2xl rounded-bl-sm">
                <span className="flex gap-1.5">
                  <span className="w-2 h-2 bg-[#1A1814]/30 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 bg-[#1A1814]/30 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 bg-[#1A1814]/30 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </span>
              </div>
            </div>
          )}
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your question..."
          className="flex-1 px-4 py-2.5 bg-white border border-[#1A1814]/10 rounded-xl text-[#1A1814] placeholder-[#1A1814]/40 text-sm focus:outline-none focus:border-[#B85C38]/50 transition-colors"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="px-4 py-2.5 bg-[#B85C38] text-white rounded-xl hover:bg-[#a04e2f] transition-colors disabled:opacity-40"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
          </svg>
        </button>
      </form>
    </div>
  );
}
