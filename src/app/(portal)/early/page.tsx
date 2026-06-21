import EarlyAccess from "@/components/EarlyAccess";
import { registrationsOpen } from "@/lib/registrations";

export default function EarlyPage() {
  return <EarlyAccess open={registrationsOpen()} />;
}
