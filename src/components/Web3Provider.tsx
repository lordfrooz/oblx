"use client";

import { createAppKit } from "@reown/appkit/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import {
  cookieToInitialState,
  WagmiProvider,
  type Config,
} from "wagmi";
import { baseNetwork, appKitMetadata, baseCustomRpcUrls, networks, projectId, wagmiAdapter, wagmiConfig } from "@/config/wagmi";

if (projectId) {
  createAppKit({
    adapters: [wagmiAdapter],
    projectId,
    networks,
    defaultNetwork: baseNetwork,
    metadata: appKitMetadata,
    customRpcUrls: baseCustomRpcUrls,
    themeMode: "dark",
    themeVariables: {
      "--w3m-accent": "#f0f0f5",
      "--w3m-border-radius-master": "12px",
    },
    features: {
      analytics: false,
    },
    enableCoinbase: false,
  });
}

export function Web3Provider({
  children,
  cookies,
}: {
  children: ReactNode;
  cookies: string | null;
}) {
  const [queryClient] = useState(() => new QueryClient());
  const initialState = cookieToInitialState(wagmiConfig as Config, cookies);

  if (!projectId) {
    console.warn("NEXT_PUBLIC_REOWN_PROJECT_ID is not set — wallet modal disabled.");
  }

  return (
    <WagmiProvider config={wagmiConfig as Config} initialState={initialState}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
