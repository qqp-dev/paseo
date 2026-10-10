import { createContext, useContext, type ReactNode } from "react";
import { RetainedPanelActivity } from "@/components/retained-panel";

// Keep coverage separate from panel activity so only stream presentation inherits the gate.
const CoveredStreamPresentationContext = createContext(false);

export function CoveredStreamPresentationProvider({
  covered,
  children,
}: {
  covered: boolean;
  children: ReactNode;
}) {
  return (
    <CoveredStreamPresentationContext value={covered}>{children}</CoveredStreamPresentationContext>
  );
}

export function AgentStreamPresentationActivity({ children }: { children: ReactNode }) {
  const covered = useContext(CoveredStreamPresentationContext);
  return <RetainedPanelActivity active={!covered}>{children}</RetainedPanelActivity>;
}
