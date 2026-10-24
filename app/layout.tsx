import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Nexa — Support & Lead Intelligence",
  description: "Better conversations. Stronger connections.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
