import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "usertrust — trust() your AI spend",
  description:
    "Budget holds, audit trails, and spend limits for every LLM call. Open source SDK. Keep your keys, keep your billing.",
  openGraph: {
    title: "usertrust — trust() your AI spend",
    description:
      "Budget holds, audit trails, and spend limits for every LLM call. Open source SDK. Keep your keys, keep your billing.",
    url: "https://usertrust.ai",
    siteName: "UserTrust",
    images: [
      {
        url: "https://usertrust.ai/og.png",
        width: 1200,
        height: 630,
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "usertrust — trust() your AI spend",
    description:
      "Budget holds, audit trails, and spend limits for every LLM call. Open source SDK. Keep your keys, keep your billing.",
    images: ["https://usertrust.ai/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
  },
};

function JsonLd() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "UserTrust",
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Any",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    description:
      "Budget holds, audit trails, and spend limits for every LLM call. Open source SDK.",
    url: "https://usertrust.ai",
    license: "https://opensource.org/licenses/Apache-2.0",
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="antialiased">
      <head>
        <JsonLd />
      </head>
      <body>{children}</body>
    </html>
  );
}
