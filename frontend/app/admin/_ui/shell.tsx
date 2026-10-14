"use client";

import type { ReactNode } from "react";
import { DEPLOYER_WALLET } from "@/lib/admin";
import { shorten } from "@/lib/units";
import { Card, PageHead, useDashboard } from "../../dashboard/_ui/shell";

/** Admin pages sit inside the API Console. Anyone else stays on the lock. */
export function DeployerOnly({ children }: { children: ReactNode }) {
  const { session } = useDashboard();
  if (session.wallet === DEPLOYER_WALLET) return children;

  return (
    <>
      <PageHead title="Admin" sub="These pages live in the API Console. Only the program deployer can open them." />
      <Card plain title="Locked" sub={`Signed in as ${shorten(session.wallet, 4, 4)}. Only the wallet that deployed the goblock program can open these pages.`}>
        <p>The admin menu stays hidden for every other wallet.</p>
      </Card>
    </>
  );
}
