import type { Intent } from "@/lib/types";
export function IntentBadge({ intent }: { intent: Intent }) {
  const label = {
    faq: "FAQ",
    hot_lead: "Hot lead",
    needs_human: "Needs human",
  }[intent];
  return (
    <span
      className={`badge ${intent === "hot_lead" ? "badge-orange" : intent === "needs_human" ? "badge-purple" : "badge-teal"}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
export function ErrorNotice({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="error-box flex flex-wrap items-center justify-between gap-3"
    >
      <p>{message}</p>
      {onRetry && (
        <button
          className="font-semibold underline underline-offset-4"
          onClick={onRetry}
        >
          Try again
        </button>
      )}
    </div>
  );
}
