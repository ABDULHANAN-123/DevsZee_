"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { canUpdateStatus, getLeads, updateLeadStatus } from "@/lib/api";
import { ALERTS_URL, MOCK_MODE, ownApi } from "@/lib/config";
import { dateTime, dayKey, errorText } from "@/lib/format";
import { alertKey, listenToMock, mockAlerts } from "@/lib/mock";
import {
  isAlert,
  type AlertEvent,
  type FeedAlert,
  type Lead,
  type LeadStatus,
} from "@/lib/types";
import { Icon } from "./icons";
import { ErrorNotice, IntentBadge } from "./ui";
const statuses: LeadStatus[] = ["new", "contacted", "closed"];
function leadAlert(lead: Lead): AlertEvent {
  return {
    type: "alert",
    intent: lead.intent,
    message: lead.raw_message,
    lead: {
      name: lead.name,
      contact: lead.contact,
      need: lead.need,
      urgency: lead.urgency,
    },
    createdAt: lead.created_at,
  };
}
export function Dashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [alerts, setAlerts] = useState<FeedAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [streamNote, setStreamNote] = useState("");
  const [connection, setConnection] = useState(
    MOCK_MODE ? "This browser" : "Updates every 8s",
  );
  const [updated, setUpdated] = useState("");
  const [clock, setClock] = useState(new Date());
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [unread, setUnread] = useState(0);
  const mounted = useRef(false);
  const knownIds = useRef<Set<string> | null>(null);
  const seenEvents = useRef(new Set<string>());
  const inFlight = useRef(false);
  const refreshAgain = useRef(false);
  const pendingIds = useRef(new Set<string>());
  const clearedBefore = useRef(0);
  const pushAlert = useCallback((event: AlertEvent, count = true) => {
    const key = alertKey(event);
    if (
      Date.parse(event.createdAt) <= clearedBefore.current ||
      seenEvents.current.has(key)
    )
      return;
    seenEvents.current.add(key);
    // Bound memory on long-running dashboards.
    if (seenEvents.current.size > 1000)
      seenEvents.current.delete(seenEvents.current.values().next().value!);
    setAlerts((old) =>
      [{ ...event, feedId: key }, ...old]
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .slice(0, 50),
    );
    if (count) setUnread((old) => old + 1);
  }, []);
  const load = useCallback(async () => {
    if (!mounted.current) return;
    if (inFlight.current) {
      refreshAgain.current = true;
      return;
    }
    inFlight.current = true;
    setRefreshing(true);
    try {
      const result = await getLeads();
      if (!mounted.current) return;
      if (MOCK_MODE) {
        const events = mockAlerts();
        // An empty store should not retain old activity in the current view.
        if (!events.length) {
          setAlerts([]);
          setUnread(0);
          seenEvents.current.clear();
        }
        for (const event of [...events].reverse())
          pushAlert(event, knownIds.current !== null);
      } else if (knownIds.current) {
        for (const lead of [...result].reverse()) {
          if (!knownIds.current.has(lead.id) && lead.intent !== "faq")
            pushAlert(leadAlert(lead));
        }
      }
      knownIds.current = new Set(result.map((l) => l.id));
      setLeads(result);
      setError("");
      setUpdated(new Date().toISOString());
    } catch (e) {
      if (mounted.current) setError(errorText(e));
    } finally {
      inFlight.current = false;
      if (mounted.current) {
        setLoading(false);
        setRefreshing(false);
        if (refreshAgain.current) {
          refreshAgain.current = false;
          void load();
        }
      }
    }
  }, [pushAlert]);
  useEffect(() => {
    mounted.current = true;
    void load();
    const timer = window.setInterval(() => {
      setClock(new Date());
      void load();
    }, 8000);
    const cleanupMock = MOCK_MODE ? listenToMock(() => void load()) : () => {};
    let source: EventSource | undefined;
    if (!MOCK_MODE && ALERTS_URL) {
      try {
        source = new EventSource(ownApi(ALERTS_URL));
        const handle = (event: MessageEvent) => {
          try {
            const data: unknown = JSON.parse(event.data);
            if (!isAlert(data)) throw new Error();
            pushAlert(data);
            setStreamNote("");
            void load();
          } catch {
            setStreamNote(
              "An alert had an invalid format. Lead polling remains active.",
            );
          }
        };
        source.onopen = () => {
          setConnection("Live alerts");
          setStreamNote("");
        };
        source.onmessage = handle;
        source.addEventListener("alert", handle as EventListener);
        source.onerror = () => {
          setConnection("Reconnecting · polling active");
          setStreamNote(
            "Alert stream interrupted. Reconnecting automatically; leads still refresh every 8 seconds.",
          );
        };
      } catch (e) {
        setStreamNote(errorText(e));
      }
    }
    return () => {
      mounted.current = false;
      clearInterval(timer);
      cleanupMock();
      source?.close();
    };
  }, [load, pushAlert]);
  async function changeStatus(lead: Lead, status: LeadStatus) {
    if (pendingIds.current.has(lead.id) || status === lead.status) return;
    pendingIds.current.add(lead.id);
    setPending((old) => ({ ...old, [lead.id]: true }));
    setActionError("");
    try {
      await updateLeadStatus(lead.id, status);
      if (mounted.current) {
        setLeads((old) =>
          old.map((l) => (l.id === lead.id ? { ...l, status } : l)),
        );
        await load();
      }
    } catch (e) {
      if (mounted.current) setActionError(errorText(e));
    } finally {
      pendingIds.current.delete(lead.id);
      if (mounted.current) setPending((old) => ({ ...old, [lead.id]: false }));
    }
  }
  const todayCount = leads.filter(
    (l) => l.intent === "hot_lead" && dayKey(l.created_at) === dayKey(clock),
  ).length;
  const humanCount = leads.filter(
    (l) => l.intent === "needs_human" && l.status !== "closed",
  ).length;
  const newCount = leads.filter((l) => l.status === "new").length;
  const visible = leads.filter(
    (l) =>
      (filter === "all" || l.status === filter) &&
      [l.name, l.contact, l.need, l.raw_message].some((v) =>
        v?.toLowerCase().includes(search.toLowerCase()),
      ),
  );
  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">NEXA / OWNER WORKSPACE</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Your next opportunity starts here.
          </h1>
          <p className="muted mt-2 text-sm">
            Prioritize conversations, follow up with leads, and keep your team
            in the loop.
          </p>
        </div>
        <button
          className="btn-secondary"
          onClick={() => void load()}
          disabled={refreshing}
        >
          <Icon name="refresh" className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </section>
      {error && <ErrorNotice message={error} onRetry={() => void load()} />}
      {actionError && <ErrorNotice message={actionError} />}
      {streamNote && (
        <p className="muted text-sm" role="status">
          {streamNote}
        </p>
      )}
      <section
        className="grid gap-4 sm:grid-cols-3"
        aria-label="Lead statistics"
      >
        {[
          {
            label: "HOT LEADS TODAY",
            value: todayCount,
            caption: "Ready to take the next step",
            icon: "spark" as const,
            color: "orange",
          },
          {
            label: "AWAITING FIRST CONTACT",
            value: newCount,
            caption: "New leads & human requests",
            icon: "users" as const,
            color: "teal",
          },
          {
            label: "NEED A HUMAN",
            value: humanCount,
            caption: "Open requests for your team",
            icon: "chat" as const,
            color: "purple",
          },
        ].map((stat) => (
          <div key={stat.label} className="panel p-5">
            <div className="flex items-center justify-between">
              <p className="muted text-[10px] font-bold tracking-[0.13em]">
                {stat.label}
              </p>
              <span className={`stat-icon badge-${stat.color}`}>
                <Icon name={stat.icon} />
              </span>
            </div>
            {loading ? (
              <div className="skeleton my-3 h-10 w-16" />
            ) : (
              <p className="mt-2 text-4xl font-semibold tracking-tight">
                {stat.value}
              </p>
            )}
            <p className="muted mt-2 text-xs">{stat.caption}</p>
          </div>
        ))}
      </section>
      <div className="grid items-start gap-6 xl:grid-cols-[1fr_340px]">
        <section className="panel min-w-0 overflow-hidden">
          <div className="border-b border-[var(--line)] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold">Your leads</h2>
                <span className="count-chip">{leads.length}</span>
              </div>
              <span className="muted text-[11px]">
                Business dates: Pakistan time
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <label className="input-shell min-w-44 flex-1">
                <Icon name="search" width="16" height="16" />
                <span className="sr-only">Search leads</span>
                <input
                  className="min-w-0 flex-1 bg-transparent outline-none"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, contact, or request…"
                />
              </label>
              <label className="sr-only" htmlFor="status-filter">
                Filter by status
              </label>
              <select
                id="status-filter"
                className="input-shell"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="all">All statuses</option>
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {s[0].toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {!canUpdateStatus && (
            <p className="muted border-b border-[var(--line)] px-5 py-3 text-xs">
              Status changes are currently unavailable. You can still review
              requests and contact details.
            </p>
          )}
          {loading ? (
            <div
              className="space-y-4 p-5"
              role="status"
              aria-label="Loading leads"
            >
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-20 w-full" />
              ))}
              <span className="sr-only">Loading leads…</span>
            </div>
          ) : !visible.length ? (
            <div className="px-6 py-16 text-center">
              <span className="empty-icon">
                <Icon name="users" width="27" height="27" />
              </span>
              <h3 className="mt-4 font-semibold">
                {error && !leads.length
                  ? "Leads are temporarily unavailable"
                  : leads.length
                    ? "No matching leads"
                    : "Your next connection belongs here"}
              </h3>
              <p className="muted mx-auto mt-2 max-w-sm text-sm leading-6">
                {error && !leads.length
                  ? "Try loading again using the error message above."
                  : leads.length
                    ? "Try another search or change the status filter."
                    : "When a customer expresses interest or requests help, you’ll find their details here."}
              </p>
              {leads.length > 0 && (
                <button
                  className="text-button mt-4"
                  onClick={() => {
                    setSearch("");
                    setFilter("all");
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[740px] text-left text-sm">
                <caption className="sr-only">Saved leads, newest first</caption>
                <thead>
                  <tr className="table-head">
                    <th>PERSON / CONTACT</th>
                    <th>REQUEST</th>
                    <th>INTENT</th>
                    <th>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((lead) => (
                    <tr key={lead.id} className="lead-row">
                      <td className="max-w-[210px]">
                        <div className="flex items-start gap-2.5">
                          <span className="avatar">
                            {(lead.name || "?")
                              .split(" ")
                              .map((s) => s[0])
                              .slice(0, 2)
                              .join("")}
                          </span>
                          <div className="min-w-0">
                            <p className="break-words font-semibold">
                              {lead.name || "Name not provided"}
                            </p>
                            <p className="muted mt-1 break-words text-xs">
                              {lead.contact || "Contact not provided"}
                            </p>
                            <p className="muted mt-2 text-[10px]">
                              {dateTime(lead.created_at)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="max-w-[250px]">
                        <p
                          className="line-clamp-3 break-words text-xs leading-5"
                          title={lead.need || lead.raw_message}
                        >
                          {lead.need || lead.raw_message}
                        </p>
                        <details className="mt-2 text-xs">
                          <summary className="cursor-pointer font-medium text-[var(--accent)]">
                            View message
                          </summary>
                          <p className="mt-2 whitespace-pre-wrap break-words leading-5">
                            {lead.raw_message}
                          </p>
                        </details>
                        {lead.urgency && (
                          <p
                            className={`mt-2 text-[10px] font-medium ${lead.urgency === "high" ? "text-[var(--orange)]" : "muted"}`}
                          >
                            {lead.urgency === "high" ? "↑ " : ""}
                            {lead.urgency} priority
                          </p>
                        )}
                      </td>
                      <td>
                        <IntentBadge intent={lead.intent} />
                      </td>
                      <td>
                        <div
                          className="flex flex-col items-start gap-1.5"
                          role="group"
                          aria-label={`Status for ${lead.name || "unnamed lead"}`}
                        >
                          {statuses.map((status) => (
                            <button
                              key={status}
                              aria-pressed={lead.status === status}
                              onClick={() => void changeStatus(lead, status)}
                              disabled={
                                pending[lead.id] ||
                                !canUpdateStatus ||
                                lead.status === status
                              }
                              className={`status-button ${lead.status === status ? "status-selected" : ""}`}
                            >
                              {lead.status === status && (
                                <Icon name="check" width="11" height="11" />
                              )}
                              {status[0].toUpperCase() + status.slice(1)}
                            </button>
                          ))}
                          {pending[lead.id] && (
                            <span className="muted text-[10px]" role="status">
                              Saving…
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="muted flex flex-wrap justify-between gap-2 border-t border-[var(--line)] px-5 py-3 text-[10px]">
            <span>
              {visible.length} of {leads.length} requests
            </span>
            <span>
              {updated
                ? `Updated ${dateTime(updated)} PKT`
                : "Waiting for first load"}
            </span>
          </div>
        </section>
        <aside className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--line)] p-5">
            <div className="flex items-center gap-2">
              <Icon name="bell" />
              <h2 className="font-semibold">Activity</h2>
              {unread > 0 && (
                <span
                  className="count-chip"
                  aria-label={`${unread} unread alerts`}
                >
                  {unread}
                </span>
              )}
            </div>
            <button
              className="text-button !text-xs"
              onClick={() => setUnread(0)}
              disabled={!unread}
            >
              Mark read
            </button>
          </div>
          <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-3">
            <span className="muted flex items-center gap-2 text-[10px]">
              <span
                className={`h-1.5 w-1.5 rounded-full ${error ? "bg-[var(--orange)]" : "bg-[var(--accent)]"}`}
              />
              {connection}
            </span>
            <button
              className="muted text-[10px] underline underline-offset-2"
              disabled={!alerts.length}
              onClick={() => {
                clearedBefore.current = Date.now();
                setAlerts([]);
                setUnread(0);
              }}
            >
              Clear feed
            </button>
          </div>
          <div
            className="max-h-[610px] overflow-y-auto"
            role="log"
            aria-label="Owner alert feed"
            aria-live="polite"
            aria-relevant="additions"
          >
            {loading ? (
              <div className="space-y-4 p-5" role="status">
                <span className="sr-only">Loading alerts</span>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="skeleton h-24" />
                ))}
              </div>
            ) : !alerts.length ? (
              <div className="px-6 py-14 text-center">
                <span className="empty-icon">
                  <Icon name="bell" />
                </span>
                <p className="mt-4 text-sm font-semibold">
                  You’re all caught up
                </p>
                <p className="muted mt-2 text-xs leading-5">
                  New leads and requests for help will appear here.
                  {!MOCK_MODE && !ALERTS_URL
                    ? " Existing leads are shown in the table; this feed tracks arrivals after you open it."
                    : ""}
                </p>
              </div>
            ) : (
              alerts.map((alert) => (
                <article
                  key={alert.feedId}
                  className="border-b border-[var(--line)] px-5 py-4 last:border-0"
                >
                  <div className="flex items-center justify-between gap-2">
                    <IntentBadge intent={alert.intent} />
                    <time
                      className="muted shrink-0 text-[10px]"
                      dateTime={alert.createdAt}
                    >
                      {dateTime(alert.createdAt)}
                    </time>
                  </div>
                  <h3 className="mt-3 text-sm font-semibold">
                    {alert.lead?.name ||
                      (alert.intent === "hot_lead"
                        ? "A new opportunity"
                        : "Someone needs your help")}
                  </h3>
                  <p className="muted mt-1 line-clamp-3 break-words text-xs leading-5">
                    {alert.message}
                  </p>
                  {alert.lead?.contact && (
                    <p className="mt-2 break-words text-[11px] font-medium text-[var(--accent)]">
                      {alert.lead.contact}
                    </p>
                  )}
                </article>
              ))
            )}
          </div>
          <p className="muted border-t border-[var(--line)] px-5 py-3 text-[10px]">
            Showing the latest 50 updates
          </p>
        </aside>
      </div>
    </div>
  );
}
