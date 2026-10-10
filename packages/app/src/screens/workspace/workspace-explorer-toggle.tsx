import { PanelRight } from "lucide-react-native";
import { useCallback } from "react";
import { type GestureResponderEvent, type StyleProp, type ViewStyle } from "react-native";
import { withUnistyles } from "react-native-unistyles";
import { HeaderToggleButton } from "@/components/headers/header-toggle-button";
import {
  extraMutedIconColorMapping,
  iconButtonChromeGlyphSize,
  mutedIconColorMapping,
} from "@/components/ui/icon-button-chrome";
import type { ShortcutKey } from "@/utils/format-shortcut";
import { traceMobilePanelControl } from "@/mobile-panels/trace";
import { isProfileBuild } from "@/constants/build-profile";

const ThemedPanelRight = withUnistyles(PanelRight);
const traceExplorerPressIn = (event: GestureResponderEvent) =>
  traceMobilePanelControl("explorer", "press-in", event);

interface WorkspaceExplorerToggleProps {
  onPress: () => void;
  label: string;
  tooltipLabel: string;
  tooltipKeys: ShortcutKey[];
  accessibilityState: { expanded: boolean };
  mobile: boolean;
  style?: StyleProp<ViewStyle>;
}

export type WorkspaceExplorerToggleOwner = "mobile" | "header" | "window";

export function resolveWorkspaceExplorerToggleOwner({
  isMobile,
  hasMacTrafficLights,
}: {
  isMobile: boolean;
  hasMacTrafficLights: boolean;
}): WorkspaceExplorerToggleOwner {
  if (isMobile) return "mobile";
  return hasMacTrafficLights ? "window" : "header";
}

export function WorkspaceExplorerToggle({
  onPress,
  label,
  tooltipLabel,
  tooltipKeys,
  accessibilityState,
  mobile,
  style,
}: WorkspaceExplorerToggleProps) {
  const handlePress = useCallback(
    (event: GestureResponderEvent) => {
      traceMobilePanelControl("explorer", "press", event);
      onPress();
    },
    [onPress],
  );
  return (
    <HeaderToggleButton
      testID="workspace-explorer-toggle"
      onPressIn={isProfileBuild && mobile ? traceExplorerPressIn : undefined}
      onPress={isProfileBuild && mobile ? handlePress : onPress}
      tooltipLabel={tooltipLabel}
      tooltipKeys={tooltipKeys}
      tooltipSide="left"
      style={style}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={accessibilityState}
    >
      <ThemedPanelRight
        size={iconButtonChromeGlyphSize("large")}
        strokeWidth={1.5}
        uniProps={mobile ? mutedIconColorMapping : extraMutedIconColorMapping}
      />
    </HeaderToggleButton>
  );
}

interface DesktopWorkspaceExplorerToggleProps extends Omit<WorkspaceExplorerToggleProps, "mobile"> {
  owner: WorkspaceExplorerToggleOwner;
}

export function WorkspaceHeaderExplorerToggle({
  owner,
  accessibilityState,
  style,
  ...toggleProps
}: DesktopWorkspaceExplorerToggleProps) {
  if (owner === "mobile" || (owner === "window" && accessibilityState.expanded)) return null;
  return (
    <WorkspaceExplorerToggle
      {...toggleProps}
      accessibilityState={accessibilityState}
      mobile={false}
      style={style}
    />
  );
}

export function WorkspaceExplorerSidebarToggle({
  owner,
  ...toggleProps
}: DesktopWorkspaceExplorerToggleProps) {
  if (owner !== "window") return null;
  return <WorkspaceExplorerToggle {...toggleProps} mobile={false} />;
}
