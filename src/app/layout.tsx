import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Smoke } from "@/components/Smoke";

const sans = Inter({
  variable: "--font-sans-stack",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono-stack",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const SITE_URL = "https://oblx.ink";
const OG_IMAGE = `${SITE_URL}/og.png`;

export const metadata: Metadata = {
  title: "OBLX.INK — Early Access",
  description:
    "OBLX.INK — ink & on-chain inscriptions on Base. Inscribe your place in early access.",
  metadataBase: new URL(SITE_URL),
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "OBLX.INK",
    locale: "en_US",
    title: "OBLX.INK — Early Access",
    description: "Ink & inscriptions on Base. The ritual begins.",
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "OBLX.INK — Ink & inscriptions on Base",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@oblxink",
    creator: "@oblxink",
    title: "OBLX.INK — Early Access",
    description: "Ink & inscriptions on Base. The ritual begins.",
    images: [OG_IMAGE],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="grain vignette min-h-full bg-ink-void text-ink-white">
        <Smoke />
        {children}
      </body>
    </html>
  );
}
