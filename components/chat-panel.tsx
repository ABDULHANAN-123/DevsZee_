"use client";
import { useEffect, useRef, useState } from "react";
import { sendChat } from "@/lib/api";
import { brand } from "@/lib/brand";
import { errorText } from "@/lib/format";
import { uid } from "@/lib/mock";
import type { ChatMessage } from "@/lib/types";
import { Icon } from "./icons";
import { ErrorNotice } from "./ui";
const SESSION_KEY = "triage.customer-session.v1";
const welcome: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content: brand.welcome,
};
const suggestions = [
  "How can you help me?",
  "I’m interested in your services",
  "I’d like to speak to someone",
];
export function ChatPanel() {
  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([welcome]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sessionWarning, setSessionWarning] = useState("");
  const [failed, setFailed] = useState<{ id: string; content: string } | null>(
    null,
  );
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sending = useRef(false);
  useEffect(() => {
    const fresh = uid();
    try {
      const existing = localStorage.getItem(SESSION_KEY);
      const id = existing || fresh;
      localStorage.setItem(SESSION_KEY, id);
      setSessionId(id);
    } catch {
      setSessionId(fresh);
      setSessionWarning(
        "Browser storage is unavailable. This session lasts until you refresh.",
      );
    }
  }, []);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, busy]);
  async function send(text: string, retryId?: string) {
    const message = text.trim();
    if (!message || message.length > 4000 || sending.current || !sessionId)
      return;
    sending.current = true;
    setBusy(true);
    setError("");
    setFailed(null);
    const id = retryId || uid();
    if (!retryId) {
      setMessages((old) => [...old, { id, role: "user", content: message }]);
      setDraft("");
    }
    try {
      const result = await sendChat(sessionId, message);
      setMessages((old) => [
        ...old,
        {
          id: uid(),
          role: "assistant",
          content: result.reply,
          intent: result.intent,
        },
      ]);
    } catch (e) {
      setError(errorText(e));
      setFailed({ id, content: message });
    } finally {
      sending.current = false;
      setBusy(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }
  return (
    <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14">
      <section className="self-center py-2 lg:py-10">
        <p className="eyebrow">
          <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />A BETTER
          WAY TO CONNECT
        </p>
        <h1 className="mt-4 max-w-lg text-3xl font-semibold leading-[1.12] tracking-tight sm:text-5xl lg:text-6xl">
          Every question.
          <br />
          <span className="text-[var(--accent)]">A better connection.</span>
        </h1>
        <p className="muted mt-5 max-w-md text-base leading-7">
          Get the information you need and connect with the right people. One
          conversation is all it takes to get started.
        </p>
        <div className="mt-8 hidden max-w-md grid-cols-3 gap-3 border-y border-[var(--line)] py-5 lg:grid">
          <div>
            <p className="font-semibold">Ask</p>
            <p className="muted mt-1 text-xs">Find your next step</p>
          </div>
          <div>
            <p className="font-semibold">Connect</p>
            <p className="muted mt-1 text-xs">Talk to the team</p>
          </div>
          <div>
            <p className="font-semibold">Follow through</p>
            <p className="muted mt-1 text-xs">Keep things moving</p>
          </div>
        </div>
        <div className="panel mt-7 hidden max-w-md items-start gap-3 p-4 lg:flex">
          <span className="rounded-xl bg-[var(--accent-soft)] p-2 text-[var(--accent)]">
            <Icon name="users" />
          </span>
          <p className="muted text-sm leading-6">
            <strong className="text-[var(--text)]">
              People are always part of the conversation.
            </strong>
            <br />
            Some questions need a personal touch. Ask to connect with our team
            whenever you need help.
          </p>
        </div>
      </section>
      <section
        className="panel flex h-[min(740px,83dvh)] min-h-[500px] flex-col overflow-hidden shadow-xl shadow-black/5"
        aria-label="Customer support chat"
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-5">
          <div className="flex items-center gap-3">
            <span className="brand-icon h-11 w-11">
              <Icon name="spark" />
            </span>
            <div>
              <h2 className="font-semibold">{brand.assistant}</h2>
              <p className="muted mt-1 flex items-center gap-1.5 text-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                Here to help
              </p>
            </div>
          </div>
          <span className="badge badge-teal">Ask away</span>
        </div>
        <div
          className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6"
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-label="Conversation"
        >
          <p className="muted mb-6 text-center text-[11px] font-medium tracking-widest">
            YOUR CONVERSATION STARTS HERE
          </p>
          {messages.map((message) => (
            <div
              key={message.id}
              className={`mb-5 flex gap-2.5 ${message.role === "user" ? "justify-end" : ""}`}
            >
              {message.role === "assistant" && (
                <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
                  <Icon name="spark" width="15" height="15" />
                </span>
              )}
              <div className="max-w-[88%] sm:max-w-[82%]">
                <p
                  className={`whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === "user" ? "rounded-br-sm bg-[var(--accent)] text-white" : "rounded-bl-sm bg-[var(--subtle)]"}`}
                >
                  {message.content}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="muted text-[10px]">
                    {message.role === "user" ? "You" : brand.assistant}
                  </span>
                  {message.role === "assistant" &&
                    message.intent === "needs_human" && (
                      <span className="badge badge-purple">
                        Passed to the team
                      </span>
                    )}
                  {message.role === "assistant" &&
                    message.intent === "hot_lead" && (
                      <span className="badge badge-teal">Request received</span>
                    )}
                  {failed?.id === message.id && (
                    <span className="text-xs text-[var(--danger)]">
                      Response failed
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
          {busy && (
            <div
              className="flex items-center gap-3 text-[var(--accent)]"
              role="status"
            >
              <Icon name="spark" />
              <div className="typing flex gap-1 rounded-xl bg-[var(--subtle)] px-4 py-3">
                <span />
                <span />
                <span />
              </div>
              <span className="sr-only">Assistant is typing</span>
            </div>
          )}
          <div ref={endRef} />
        </div>
        <div className="border-t border-[var(--line)] p-4 sm:p-5">
          {sessionWarning && (
            <p role="status" className="muted mb-3 text-xs">
              {sessionWarning}
            </p>
          )}
          {error && (
            <div className="mb-3">
              <ErrorNotice
                message={error}
                onRetry={
                  failed
                    ? () => void send(failed.content, failed.id)
                    : undefined
                }
              />
            </div>
          )}
          {messages.length === 1 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {suggestions.map((text) => (
                <button
                  key={text}
                  className="suggestion"
                  disabled={busy || !sessionId}
                  onClick={() => void send(text)}
                >
                  {text}
                  <Icon name="chevron" width="12" height="12" />
                </button>
              ))}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(draft);
            }}
            className="flex items-end gap-2 rounded-2xl border border-[var(--line)] bg-[var(--subtle)] p-2 focus-within:border-[var(--accent)]"
          >
            <label htmlFor="message" className="sr-only">
              Your message
            </label>
            <textarea
              id="message"
              ref={inputRef}
              rows={2}
              maxLength={4000}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  void send(draft);
                }
              }}
              placeholder="Tell us what you need…"
              disabled={busy || !sessionId}
              className="max-h-32 min-h-12 flex-1 resize-y bg-transparent px-2 py-2 text-sm outline-none disabled:opacity-60"
            />
            <button
              type="submit"
              className="btn-primary h-10 w-10 shrink-0 justify-center !rounded-xl !p-0"
              aria-label="Send message"
              disabled={busy || !sessionId || !draft.trim()}
            >
              <Icon name="arrow" />
            </button>
          </form>
          <p className="muted mt-2 text-center text-[10px]">
            Enter to send · Shift + Enter for a new line
          </p>
        </div>
      </section>
    </div>
  );
}
