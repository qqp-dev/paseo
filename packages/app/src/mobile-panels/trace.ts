import type { GestureResponderEvent } from "react-native";
import { isProfileBuild } from "@/constants/build-profile";
import { traceInstant } from "@/performance/native-trace";
import { usePanelStore, type MobilePanelView } from "@/stores/panel-store";

export function traceMobilePanelControl(
  control: "close" | "workspace-row" | "explorer",
  phase: "press-in" | "press",
  event?: GestureResponderEvent,
): void {
  if (!isProfileBuild) return;
  const selection = usePanelStore.getState().mobilePanel;
  traceInstant("paseo.panel.control", {
    control,
    phase,
    target: selection.target,
    revision: String(selection.revision),
    ...(event ? { eventTimestamp: String(event.nativeEvent.timestamp) } : {}),
  });
}

/** The UI timestamp preserves scheduling delay when this marker reaches RN later. */
export function traceMobilePanelAnchor(
  target: MobilePanelView,
  motionTarget: MobilePanelView,
  settledTarget: MobilePanelView,
  revision: number,
  uiTimestamp: number,
): void {
  if (!isProfileBuild) return;
  traceInstant("paseo.panel.anchor", {
    target,
    motion: motionTarget,
    settled: settledTarget,
    rev: String(revision),
    ui: String(uiTimestamp),
    delay: String(Math.max(0, Date.now() - uiTimestamp)),
  });
}
