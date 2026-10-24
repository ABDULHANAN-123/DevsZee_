export const BUSINESS_TIME_ZONE = "Asia/Karachi";
export function dayKey(value: string | Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}
export function dateTime(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: BUSINESS_TIME_ZONE,
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
export function errorText(value: unknown): string {
  return value instanceof Error
    ? value.message
    : "Something went wrong. Please try again.";
}
