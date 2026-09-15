"use client";

import { Thread } from "@/components/thread";
import { StreamProvider } from "@/providers/Stream";
import { ThreadProvider } from "@/providers/Thread";
import { ArtifactProvider } from "@/components/thread/artifact";
import { Toaster } from "@/components/ui/sonner";
import { AgentSettingsPanel } from "@/components/agent-settings-panel";
import React from "react";

export default function DemoPage(): React.ReactNode {
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  return (
    <React.Suspense fallback={<div>Loading (layout)...</div>}>
      <Toaster />
      <AgentSettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
      <ThreadProvider>
        <StreamProvider>
          <ArtifactProvider>
            <Thread onOpenSettings={() => setSettingsOpen(true)} />
          </ArtifactProvider>
        </StreamProvider>
      </ThreadProvider>
    </React.Suspense>
  );
}
