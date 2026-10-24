export const MOCK_MODE = process.env.NEXT_PUBLIC_USE_MOCK !== "false";
export const ALERTS_URL = process.env.NEXT_PUBLIC_ALERTS_URL || "";
export const STATUS_URL = process.env.NEXT_PUBLIC_LEAD_STATUS_URL || "";
// Keep browser requests on our own origin. No SDK or app secret belongs here.
export function ownApi(path: string): string {
  if (!path.startsWith("/api/") || path.includes("\\") || path.includes("#")) {
    throw new Error(
      "Configure a same-origin /api/ route for this integration.",
    );
  }
  const url = new URL(path, window.location.origin);
  if (
    url.origin !== window.location.origin ||
    !url.pathname.startsWith("/api/")
  ) {
    throw new Error("Only this app’s API routes are allowed.");
  }
  return url.pathname + url.search;
}
