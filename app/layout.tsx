import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"
  ),
  title: "Shipwright",
  description:
    "Deployment readiness for solo builders with unfinished GitHub repos. Analyze a repo and generate Vercel configs, README files, landing pages, and .env templates as one pull request.",
  keywords: [
    "github deployment",
    "vercel config generator",
    "readme generator",
    "deploy github repo",
    "side project tools",
    "indie dev tools",
  ],
  openGraph: {
    title: "Shipwright",
    description:
      "Deployment readiness for solo builders with unfinished GitHub repos. One diagnosis, one generated PR.",
    siteName: "Shipwright",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Shipwright",
    description:
      "AI-generated deployment configs, README, and landing page. One PR for unfinished repos.",
    creator: "@vpkdevs",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
