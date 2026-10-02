"use client";

import { Thread } from "@/components/thread";
import { StreamProvider } from "@/providers/Stream";
import { ThreadProvider } from "@/providers/Thread";
import { ArtifactProvider } from "@/components/thread/artifact";
import { Toaster } from "@/components/ui/sonner";
import { AgentSettingsPanel } from "@/components/agent-settings-panel";
import React from "react";

export function LegacyChatPage({
  fixedConfig,
  embedded = false,
}: {
  fixedConfig?: { apiUrl: string; assistantId: string };
  embedded?: boolean;
} = {}): React.ReactNode {
  return (
    <React.Suspense fallback={<div>Loading (layout)...</div>}>
      <Toaster />
      {!fixedConfig && <AgentSettingsPanel />}
      <ThreadProvider fixedConfig={fixedConfig}>
        <StreamProvider fixedConfig={fixedConfig}>
          <ArtifactProvider>
            <Thread embedded={embedded} />
          </ArtifactProvider>
        </StreamProvider>
      </ThreadProvider>
    </React.Suspense>
  );
}
