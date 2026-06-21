import EarlyAccess from "@/components/EarlyAccess";
import { registrationsOpen } from "@/lib/registrations";

export default function Home() {
  return <EarlyAccess open={registrationsOpen()} />;
}
