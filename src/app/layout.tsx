import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "SecondPage — Paper trades",
  description: "A private workspace for options paper trading.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
