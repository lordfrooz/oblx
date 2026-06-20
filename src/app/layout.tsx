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

export const metadata: Metadata = {
  title: "OBLX.INK — Early Access",
  description:
    "OBLX.INK — ink & on-chain inscriptions on Base. Inscribe your place in early access.",
  metadataBase: new URL("https://oblx.ink"),
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
    title: "OBLX.INK — Early Access",
    description: "Ink & inscriptions on Base. The ritual begins.",
    images: ["/logo.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "OBLX.INK — Early Access",
    description: "Ink & inscriptions on Base. The ritual begins.",
    images: ["/logo.png"],
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
