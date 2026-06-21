import type { Metadata } from "next";
import "./admin.css";
import MintAdminPanel from "@/components/MintAdminPanel";

export const metadata: Metadata = {
  title: "Ops",
  robots: { index: false, follow: false },
};

export default function MintAdminPage() {
  return <MintAdminPanel />;
}
