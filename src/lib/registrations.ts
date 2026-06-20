/** Read REGISTRATIONS_OPEN from env — true | false (default: false). */
export function registrationsOpen(): boolean {
  const v = process.env.REGISTRATIONS_OPEN?.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}
