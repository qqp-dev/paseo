import { useLayoutEffect, useState } from "react";
import { makeMutable, type SharedValue, useSharedValue } from "react-native-reanimated";
import { scheduleOnUI } from "react-native-worklets";
import { getStatusRingRotation } from "@/components/status-ring/geometry";

const sharedRotation = makeMutable(getStatusRingRotation(Date.now()));
const activeRingCount = makeMutable(0);
const clockRunning = makeMutable(false);
let nextRotationListenerId = 1;

function advanceSharedRotation(): void {
  "worklet";
  if (activeRingCount.value === 0) {
    clockRunning.value = false;
    return;
  }

  sharedRotation.value = getStatusRingRotation(Date.now());
  requestAnimationFrame(advanceSharedRotation);
}

function registerStatusRing(
  rotation: SharedValue<number>,
  registered: SharedValue<boolean>,
  listenerId: number,
): void {
  "worklet";
  if (registered.value) {
    return;
  }

  registered.value = true;
  rotation.value = getStatusRingRotation(Date.now());
  sharedRotation.addListener(listenerId, (nextRotation) => {
    rotation.value = nextRotation;
  });
  activeRingCount.value += 1;

  if (!clockRunning.value) {
    clockRunning.value = true;
    sharedRotation.value = rotation.value;
    requestAnimationFrame(advanceSharedRotation);
  }
}

function unregisterStatusRing(registered: SharedValue<boolean>, listenerId: number): void {
  "worklet";
  if (!registered.value) {
    return;
  }

  registered.value = false;
  sharedRotation.removeListener(listenerId);
  activeRingCount.value -= 1;
}

interface StatusRingActivity {
  active: boolean;
  reduceMotion: boolean;
}

export function useStatusRingRotation({
  active,
  reduceMotion,
}: StatusRingActivity): SharedValue<number> {
  // Local values let retained rings detach without unmounting their animated views.
  const rotation = useSharedValue(reduceMotion ? 0 : getStatusRingRotation(Date.now()));
  const registered = useSharedValue(false);
  const [listenerId] = useState(() => nextRotationListenerId++);

  useLayoutEffect(() => {
    if (!active || reduceMotion) {
      return;
    }

    scheduleOnUI(registerStatusRing, rotation, registered, listenerId);
    return () => {
      scheduleOnUI(unregisterStatusRing, registered, listenerId);
    };
  }, [active, listenerId, reduceMotion, registered, rotation]);

  return rotation;
}
