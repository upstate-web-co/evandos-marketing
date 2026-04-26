import { useState, useRef, useEffect } from "react";
import { streamChat } from "../../lib/chat-stream";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const INTAKE_PROMPT = `You are the intake assistant for Upstate Web Co. Your job is to have a friendly conversation with a potential client and gather the information we need to send them a quote.

You need to collect:
1. Their name
2. Their email
3. Their business name
4. What their business does
5. What they want built (website, store, app, or not sure)
6. Any specific features they need
7. Their budget range (under $750, $750-$1,500, $1,500-$3,500, $3,500+, or unsure)
8. Their timeline (ASAP, 1-2 weeks, about a month, 2-3 months, no rush)

Rules:
- Ask 1-2 questions at a time, not all at once
- Start by asking their name and what their business does
- CRITICAL: You MUST collect their email before completing. If they haven't given an email, ask for it before outputting [INTAKE_COMPLETE]. Do not complete without an email.
- Be conversational and warm — not like filling out a form
- When you have ALL required info (including email), say EXACTLY this on its own line: [INTAKE_COMPLETE]
- Then on the next line, output the collected data as JSON in this exact format:
[INTAKE_DATA]{"name":"...","email":"...","business_name":"...","business_description":"...","project_description":"...","site_type":"starter|business|store|app|unsure","budget_range":"under_750|750_1500|1500_3500|3500_plus|unsure","timeline":"asap|1_2_weeks|1_month|2_3_months|no_rush"}[/INTAKE_DATA]
- If they haven't provided budget or timeline, use "unsure" and "no_rush"
- Keep responses to 2-3 sentences
- If they seem unsure about what they need, help them think through it
- Never make up their details — only use what they tell you`;

export default function GetStartedChat() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const scrollYRef = useRef(0);
  const loadedAtRef = useRef(String(Date.now()));

  useEffect(() => {
    const el = chatContainerRef.current;
    if (el && messages.length > 0) el.scrollTop = el.scrollHeight;
    if (scrollYRef.current > 0) {
      window.scrollTo(0, scrollYRef.current);
    }
  }, [messages]);

  const submitIntake = async (data: Record<string, string>) => {
    // Don't submit without email — ask the user for it instead
    if (!data.email) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Before I submit your project, could you share your email? That way we can send you a confirmation and follow up with a quote.",
        },
      ]);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: data.name || "Chat Lead",
        email: data.email,
        phone: "",
        business_name: data.business_name || "",
        business_description: data.business_description || "",
        service_area: "",
        site_type: data.site_type || "unsure",
        project_description: data.project_description || data.business_description || "",
        budget_range: data.budget_range || "unsure",
        timeline: data.timeline || "no_rush",
        needs_payments: "unsure",
        has_existing_site: "no",
        how_found_us: "other",
        anything_else: "Submitted via chat intake on /get-started",
        pages_needed: [],
        source_page: "/get-started",
        _loaded_at: loadedAtRef.current,
        website: "", // honeypot
      };

      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSubmitted(true);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "Your project details have been submitted! We'll review everything and get back to you within one business day with a recommendation and quote. Check your email for a confirmation.",
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "I had trouble submitting your details. You can also fill out the form above, or email us at hello@upstate-web.com.",
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Something went wrong submitting. Try the form above or email hello@upstate-web.com.",
        },
      ]);
    }
    setSubmitting(false);
  };

  const send = async (text: string) => {
    if (!text.trim() || loading || submitted) return;
    scrollYRef.current = window.scrollY;
    setInput("");
    const userMsg: Message = { role: "user", content: text.trim() };
    const history = [...messages, userMsg];
    setMessages(history);
    setLoading(true);

    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    let fullResponse = "";

    await streamChat(
      history.map((m) => ({ role: m.role, content: m.content })),
      {
        agent: "intake",
        onToken: (token) => {
          fullResponse += token;
          // Don't show [INTAKE_COMPLETE] or [INTAKE_DATA] tokens to user
          const cleanDisplay = fullResponse
            .replace(/\[INTAKE_COMPLETE\][\s\S]*/g, "")
            .trim();
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last?.role === "assistant") {
              updated[updated.length - 1] = { ...last, content: cleanDisplay };
            }
            return updated;
          });
        },
        onDone: (full) => {
          fullResponse = full;
          // Check if intake is complete
          const cleanDisplay = fullResponse
            .replace(/\[INTAKE_COMPLETE\][\s\S]*/g, "")
            .trim();

          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: "assistant", content: cleanDisplay };
            return updated;
          });

          // Extract intake data if present
          const dataMatch = fullResponse.match(
            /\[INTAKE_DATA\]([\s\S]*?)\[\/INTAKE_DATA\]/
          );
          if (dataMatch) {
            try {
              const intakeData = JSON.parse(dataMatch[1]);
              submitIntake(intakeData);
            } catch {
              // JSON parse failed — continue conversation
            }
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
          <h3 className="font-semibold text-[#1A1814]">Prefer to chat?</h3>
          <p className="text-xs text-[#1A1814]/50">Tell me about your business and I'll help figure out the right plan</p>
        </div>
        {messages.filter((m) => m.content).length > 1 && !submitted && (
          <button
            onClick={() => {
              const text = messages
                .filter((m) => m.content)
                .map((m) => `${m.role === "user" ? "You" : "UWC"}: ${m.content}`)
                .join("\n\n");
              const blob = new Blob([text], { type: "text/plain" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = "uwc-project-conversation.txt";
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
          <button onClick={() => send("I need a website for my business")} className="px-3.5 py-1.5 bg-white border border-[#1A1814]/10 text-[#1A1814]/60 text-sm rounded-full hover:border-[#B85C38]/40 hover:text-[#B85C38] transition-all">
            I need a website
          </button>
          <button onClick={() => send("I want to sell products online")} className="px-3.5 py-1.5 bg-white border border-[#1A1814]/10 text-[#1A1814]/60 text-sm rounded-full hover:border-[#B85C38]/40 hover:text-[#B85C38] transition-all">
            I want an online store
          </button>
          <button onClick={() => send("I have an idea for an app")} className="px-3.5 py-1.5 bg-white border border-[#1A1814]/10 text-[#1A1814]/60 text-sm rounded-full hover:border-[#B85C38]/40 hover:text-[#B85C38] transition-all">
            I have an app idea
          </button>
          <button onClick={() => send("I'm not sure what I need yet")} className="px-3.5 py-1.5 bg-white border border-[#1A1814]/10 text-[#1A1814]/60 text-sm rounded-full hover:border-[#B85C38]/40 hover:text-[#B85C38] transition-all">
            Not sure yet
          </button>
        </div>
      )}

      {/* Messages */}
      <div
        ref={chatContainerRef}
        className={`overflow-y-auto space-y-3 pr-1 transition-all duration-300 ${
          messages.length > 0 ? "max-h-96 mb-4" : "max-h-0 overflow-hidden"
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
      {!submitted ? (
        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={submitting ? "Submitting your project..." : "Tell me about your business..."}
            disabled={submitting}
            className="flex-1 px-4 py-2.5 bg-white border border-[#1A1814]/10 rounded-xl text-[#1A1814] placeholder-[#1A1814]/40 text-sm focus:outline-none focus:border-[#B85C38]/50 transition-colors disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading || submitting}
            className="px-4 py-2.5 bg-[#B85C38] text-white rounded-xl hover:bg-[#a04e2f] transition-colors disabled:opacity-40"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        </form>
      ) : (
        <div className="text-center py-2">
          <p className="text-sm text-[#4A6741] font-medium">Project submitted successfully</p>
        </div>
      )}
    </div>
  );
}
