import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { Web3Provider } from "@/components/Web3Provider";

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
  title: "OBLX.INK",
  description:
    "Ink & inscriptions on Base. OBLX — on-chain inscription protocol.",
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
    title: "OBLX.INK",
    description: "Ink & inscriptions on Base.",
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
    title: "OBLX.INK",
    description: "Ink & inscriptions on Base.",
    images: [OG_IMAGE],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieHeader = (await headers()).get("cookie");

  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full antialiased">
        <Web3Provider cookies={cookieHeader}>{children}</Web3Provider>
      </body>
    </html>
  );
}
