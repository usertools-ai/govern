import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
	title: "usertrust — trust() your AI spend",
	description:
		"Budget holds, audit trails, and spend limits for every LLM call. Keep your keys, keep your billing. Add trust in one line.",
	keywords: [
		"AI governance",
		"LLM spend",
		"budget holds",
		"audit trail",
		"usertrust",
		"trust",
		"AI finance",
		"agent governance",
		"OpenAI",
		"Anthropic",
		"SDK",
	],
	metadataBase: new URL("https://usertrust.ai"),
	alternates: { canonical: "/" },
	openGraph: {
		title: "usertrust — trust() your AI spend",
		description:
			"Budget holds, audit trails, and spend limits for every LLM call. Keep your keys, keep your billing. Add trust in one line.",
		url: "https://usertrust.ai",
		siteName: "UserTrust",
		images: [{ url: "/og.png" }],
		type: "website",
	},
	twitter: {
		card: "summary_large_image",
		title: "usertrust — trust() your AI spend",
		description:
			"Budget holds, audit trails, and spend limits for every LLM call. Keep your keys, keep your billing. Add trust in one line.",
		images: ["/og.png"],
	},
	icons: { icon: "/favicon.svg" },
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en">
			<head>
				<script
					type="application/ld+json"
					dangerouslySetInnerHTML={{
						__html: JSON.stringify({
							"@context": "https://schema.org",
							"@type": "SoftwareApplication",
							name: "UserTrust",
							applicationCategory: "DeveloperApplication",
							license: "https://www.apache.org/licenses/LICENSE-2.0",
							offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
							author: { "@type": "Organization", name: "Usertools Inc" },
							url: "https://usertrust.ai",
							description:
								"Budget holds, audit trails, and spend limits for every LLM call.",
						}),
					}}
				/>
			</head>
			<body className="bg-brand-bg text-white font-sans antialiased overflow-x-hidden">
				{children}
			</body>
		</html>
	);
}
