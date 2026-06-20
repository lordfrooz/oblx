// Central config for the OBLX.INK early access ritual.

export const SITE = {
  name: "OBLX.INK",
  handle: "oblxink",
  chain: "Base",
} as const;

// Announcement tweet — set NEXT_PUBLIC_TARGET_TWEET_ID in .env.local
export const TARGET_TWEET_ID =
  process.env.NEXT_PUBLIC_TARGET_TWEET_ID?.trim() ?? "";

export const TARGET_TWEET_URL = TARGET_TWEET_ID
  ? `https://x.com/${SITE.handle}/status/${TARGET_TWEET_ID}`
  : "";

const enc = (s: string) => encodeURIComponent(s);

export type QuestId = "follow" | "reply" | "qrt" | "like";

export interface Quest {
  id: QuestId;
  label: string;
  hint: string;
  /** Builds the X intent url. */
  href: () => string;
}

export const QUESTS: Quest[] = [
  {
    id: "follow",
    label: `Follow @${SITE.handle}`,
    hint: "Join the ink circle.",
    href: () => `https://x.com/intent/follow?screen_name=${SITE.handle}`,
  },
  {
    id: "like",
    label: "Like the ink",
    hint: "Leave your mark.",
    href: () =>
      TARGET_TWEET_ID
        ? `https://x.com/intent/like?tweet_id=${TARGET_TWEET_ID}`
        : `https://x.com/${SITE.handle}`,
  },
  {
    id: "reply",
    label: "Reply to the ink",
    hint: "Speak into the void.",
    href: () =>
      TARGET_TWEET_ID
        ? `https://x.com/intent/tweet?in_reply_to=${TARGET_TWEET_ID}`
        : `https://x.com/${SITE.handle}`,
  },
  {
    id: "qrt",
    label: "Quote the ink",
    hint: "Echo it outward.",
    href: () =>
      TARGET_TWEET_URL
        ? `https://x.com/intent/tweet?url=${enc(TARGET_TWEET_URL)}&text=${enc(
            "ink on base. early access. if you're reading this you're still early. @oblxink",
          )}`
        : `https://x.com/${SITE.handle}`,
  },
];
