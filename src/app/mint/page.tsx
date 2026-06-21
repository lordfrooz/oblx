import type { Metadata } from "next";
import MintDashboard from "@/components/MintDashboard";

export const metadata: Metadata = {
  title: "OBLX.INK — Mint",
  description:
    "Mint OBLX ink on Base. 21M supply · 1,000 per unit · 0.00015 ETH. On-chain inscription.",
};

export default function MintPage() {
  return <MintDashboard />;
}
