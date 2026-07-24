import type { Metadata } from "next";

export const siteName = "Shipwright";
export const siteDescription = "Turn dormant repos into live products in minutes";

// NOTE: metadataBase should reflect the actual production domain. Update as needed.
export const metadataBase = new URL("https://shipwright.example.com");
const siteOrigin = metadataBase.toString();

export const defaultMetadata: Metadata = {
  title: siteName,
  description: siteDescription,
  keywords: [
    "GitHub",
    "repositories",
    "deployment",
    "AI",
    "README",
    "landing page",
    "Vercel",
    "Shipwright",
  ],
  metadataBase,
  openGraph: {
    type: "website",
    title: siteName,
    description: siteDescription,
    url: siteOrigin,
    siteName,
    images: [
      {
        url: "/og-image.svg",
        width: 1200,
        height: 630,
        alt: `${siteName} preview`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteName,
    description: siteDescription,
    images: ["/og-image.svg"],
    creator: "@shipwright",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export function makeRepoMetadata(repoPath: string): Metadata {
  const title = `${repoPath} – ${siteName}`;
  const description = `Analyze the GitHub repository ${repoPath} and generate deployment-ready configs, README, and landing pages.`;
  const url = `${siteOrigin}/repos/${repoPath}`;

  return {
    ...defaultMetadata,
    title,
    description,
    openGraph: {
      ...defaultMetadata.openGraph,
      title,
      description,
      url,
    },
    twitter: {
      ...defaultMetadata.twitter,
      title,
      description,
    },
  };
}
