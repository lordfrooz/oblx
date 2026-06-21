import type { Metadata } from "next";
import "./mint.css";

export const metadata: Metadata = {
  title: "Mint — OBLX.INK",
  description:
    "Mint OBLX on Base. 21M supply · 1,000 per unit · 0.00015 ETH. INK-20 inscription.",
};

export default function MintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="mint-app">{children}</div>;
}
