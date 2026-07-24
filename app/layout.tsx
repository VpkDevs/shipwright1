import { MarketingCapture } from "@/components/MarketingCapture";
// SEO defaults for the entire site
import { defaultMetadata, metadataBase, siteName } from "@/lib/seo";
import { ToastProvider } from "@/lib/toast";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = defaultMetadata;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const siteUrl = metadataBase.toString();
  const orgSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteName,
    url: siteUrl,
    logo: `${siteUrl}/logo.svg`,
  };

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body>
        <ToastProvider>
          <MarketingCapture />
          {children}
          <script type="application/ld+json">{JSON.stringify(orgSchema)}</script>
        </ToastProvider>
      </body>
    </html>
  );
}
