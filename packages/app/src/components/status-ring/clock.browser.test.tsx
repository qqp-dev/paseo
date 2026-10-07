import React, { act, useLayoutEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { SharedValue } from "react-native-reanimated";
import { afterEach, describe, expect, it } from "vitest";
// Exercise the native subscription implementation with the real browser scheduler.
import { useStatusRingRotation } from "./clock.js";

interface RingPolicy {
  active: boolean;
  reduceMotion: boolean;
}

interface MountedRings {
  root: Root;
  container: HTMLDivElement;
  rotations: Map<string, SharedValue<number>>;
}

const mountedRings: MountedRings[] = [];

function Ring({
  id,
  policy,
  rotations,
}: {
  id: string;
  policy: RingPolicy;
  rotations: Map<string, SharedValue<number>>;
}) {
  const rotation = useStatusRingRotation(policy);
  useLayoutEffect(() => {
    rotations.set(id, rotation);
    return () => {
      rotations.delete(id);
    };
  }, [id, rotation, rotations]);
  return <span data-ring={id} />;
}

function renderRings(mounted: MountedRings, policies: Record<string, RingPolicy>): void {
  act(() => {
    mounted.root.render(
      Object.entries(policies).map(([id, policy]) => (
        <Ring key={id} id={id} policy={policy} rotations={mounted.rotations} />
      )),
    );
  });
}

function mountRings(policies: Record<string, RingPolicy>): MountedRings {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const mounted: MountedRings = { root: createRoot(container), container, rotations: new Map() };
  mountedRings.push(mounted);
  renderRings(mounted, policies);
  return mounted;
}

function rotationOf(mounted: MountedRings, id: string): number {
  const rotation = mounted.rotations.get(id);
  if (!rotation) {
    throw new Error(`Ring ${id} did not mount`);
  }
  return rotation.value;
}

async function nextFrames(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
}

afterEach(async () => {
  for (const mounted of mountedRings.splice(0)) {
    act(() => mounted.root.unmount());
    mounted.container.remove();
  }
  await nextFrames();
});

describe("native status-ring subscriptions", () => {
  it("keeps an inactive retained ring detached while another ring advances", async () => {
    const mounted = mountRings({
      visible: { active: true, reduceMotion: false },
      hidden: { active: false, reduceMotion: false },
    });
    await nextFrames();
    const hiddenRotation = rotationOf(mounted, "hidden");
    const visibleRotation = rotationOf(mounted, "visible");

    await nextFrames();

    expect(rotationOf(mounted, "hidden")).toBe(hiddenRotation);
    expect(rotationOf(mounted, "visible")).not.toBe(visibleRotation);
  });

  it("leaves reduced-motion rings static while eligible rings advance", async () => {
    const mounted = mountRings({
      static: { active: true, reduceMotion: true },
      animated: { active: true, reduceMotion: false },
    });
    await nextFrames();
    const animatedRotation = rotationOf(mounted, "animated");

    await nextFrames();

    expect(rotationOf(mounted, "static")).toBe(0);
    expect(rotationOf(mounted, "animated")).not.toBe(animatedRotation);
  });

  it("preserves retained identity and resumes multiple consumers in phase after final teardown", async () => {
    const enabled = { active: true, reduceMotion: false };
    const hidden = { active: false, reduceMotion: false };
    const mounted = mountRings({ first: enabled, second: enabled });
    await nextFrames();
    const firstElement = mounted.container.querySelector('[data-ring="first"]');

    expect(rotationOf(mounted, "first")).toBe(rotationOf(mounted, "second"));

    renderRings(mounted, { first: hidden, second: enabled });
    await nextFrames();
    const firstHiddenRotation = rotationOf(mounted, "first");
    await nextFrames();

    expect(rotationOf(mounted, "first")).toBe(firstHiddenRotation);

    renderRings(mounted, { first: hidden, second: hidden });
    await nextFrames();
    const secondHiddenRotation = rotationOf(mounted, "second");
    await nextFrames();

    expect(rotationOf(mounted, "first")).toBe(firstHiddenRotation);
    expect(rotationOf(mounted, "second")).toBe(secondHiddenRotation);

    renderRings(mounted, { first: enabled, second: enabled });
    renderRings(mounted, { first: hidden, second: hidden });
    renderRings(mounted, { first: enabled, second: enabled });
    await nextFrames();

    expect(rotationOf(mounted, "first")).toBe(rotationOf(mounted, "second"));
    expect(rotationOf(mounted, "first")).not.toBe(firstHiddenRotation);
    expect(mounted.container.querySelector('[data-ring="first"]')).toBe(firstElement);
  });
});
