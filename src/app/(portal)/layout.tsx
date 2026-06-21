import { Smoke } from "@/components/Smoke";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Smoke />
      <div className="grain vignette relative z-10 min-h-screen bg-ink-void text-ink-white">
        {children}
      </div>
    </>
  );
}
