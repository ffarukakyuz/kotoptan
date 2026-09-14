import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";

import { askGemini } from "@/lib/gemini";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Msg = { role: "user" | "assistant"; content: string };

const GREETING: Msg = {
  role: "assistant",
  content:
    "Merhaba, ben Ko 👋 KasımOğulları destek asistanıyım. Ürünler, kategoriler, sipariş verme ve teslimat hakkında sorabilirsiniz.",
};

export function SupportChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const conversationHistory = next.filter((m) => m !== GREETING).slice(-12);
      const replyText = await askGemini(conversationHistory);

      setMessages((m) => [...m, { role: "assistant", content: replyText }]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Bağlantı sorunu oldu, lütfen tekrar deneyin." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-4 z-50 flex h-[28rem] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-pop">
          <div className="flex items-center gap-2 bg-secondary px-4 py-3 text-secondary-foreground">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
              Ko
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold">Ko — Destek Asistanı</p>
              <p className="text-xs text-secondary-foreground/70">Ürünler ve siparişler hakkında</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Sohbeti kapat"
              className="ml-auto rounded-md p-1 hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === "user"
                    ? "ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground"
                    : "mr-auto max-w-[90%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-sm text-foreground"
                }
              >
                {m.content}
              </div>
            ))}
            {loading && (
              <div className="mr-auto flex items-center gap-2 rounded-2xl bg-muted px-3 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Yazıyor...
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form
            className="flex gap-2 border-t border-border p-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Sorunuzu yazın..."
              maxLength={500}
            />
            <Button type="submit" size="icon" disabled={loading || input.trim() === ""}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Destek asistanı Ko"
        className="fixed bottom-5 right-4 z-50 flex h-14 items-center gap-2 rounded-full bg-primary px-4 font-semibold text-primary-foreground shadow-pop transition-transform hover:scale-105"
      >
        <MessageCircle className="h-5 w-5" />
        <span className="text-sm">Ko</span>
      </button>
    </>
  );
}