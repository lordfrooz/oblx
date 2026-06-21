import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import type { AppKitNetwork } from "@reown/appkit/networks";
import type { CustomRpcUrlMap } from "@reown/appkit-common";
import { base as baseChain } from "viem/chains";
import {
  BASE_CAIP_NETWORK_ID,
  getPublicBaseRpcUrl,
} from "@/lib/rpc";
import { cookieStorage, createStorage, http } from "wagmi";

export const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ?? "";

const baseRpcUrl = getPublicBaseRpcUrl();

/** Base with Alchemy as the only public RPC (avoids mixed fallback endpoints). */
export const baseNetwork = {
  ...baseChain,
  rpcUrls: {
    default: { http: [baseRpcUrl] },
    public: { http: [baseRpcUrl] },
  },
} as const satisfies AppKitNetwork;

export const networks = [baseNetwork] as [AppKitNetwork, ...AppKitNetwork[]];

export const baseCustomRpcUrls: CustomRpcUrlMap = {
  [BASE_CAIP_NETWORK_ID]: [{ url: baseRpcUrl }],
};

export const appKitMetadata = {
  name: "OBLX.INK",
  description: "Ink & inscriptions on Base. Mint OBLX via INK-20.",
  url: "https://oblx.ink",
  icons: ["https://oblx.ink/logo.png"],
};

export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({ storage: cookieStorage }),
  ssr: true,
  projectId,
  networks,
  customRpcUrls: baseCustomRpcUrls,
  transports: {
    [baseNetwork.id]: http(baseRpcUrl),
  },
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;
