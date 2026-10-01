import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { DaemonClient } from "@getpaseo/client/internal/daemon-client";
import { test, expect } from "../support/fixtures";
import { seedWorkspace } from "../support/helpers/seed-client";
import { openAgentRoute } from "../support/helpers/mock-agent";
import { submitMessage } from "../support/helpers/composer";

test.use({ e2eInjectPaseoTools: true });
test.describe.configure({ timeout: 600_000 });

test("OpenSpec preference plans here and uses the existing child track for implementation", async ({
  page,
}) => {
  test.setTimeout(600_000);
  const workspace = await seedWorkspace({
    repoPrefix: "openspec-planning-",
    repo: { withRemote: true },
  });
  const client = workspace.client as unknown as DaemonClient;
  try {
    execFileSync("openspec", ["init", "--tools", "codex", "--profile", "core"], {
      cwd: workspace.repoPath,
      stdio: "ignore",
    });
    const parent = await workspace.client.createAgent({
      provider: "codex",
      thinkingOptionId: "high",
      modeId: "full-access",
      cwd: workspace.repoPath,
      workspaceId: workspace.workspaceId,
      title: "OpenSpec planning acceptance",
      featureValues: { openspec_planning: true },
    });
    await openAgentRoute(page, { agentId: parent.id, workspaceId: workspace.workspaceId });
    await submitMessage(
      page,
      "Use openspec-propose to propose a tiny change named add-greeting: create greeting.txt containing exactly hello followed by a newline. This is a disposable synthetic acceptance project with a local bare remote. Keep the proposal concise.",
    );
    const tasks = path.join(workspace.repoPath, "openspec", "changes", "add-greeting", "tasks.md");
    await expect.poll(() => existsSync(tasks), { timeout: 300_000 }).toBe(true);
    await workspace.client.waitForFinish(parent.id, 300_000);
    expect(existsSync(path.join(workspace.repoPath, "greeting.txt"))).toBe(false);
    expect(readFileSync(tasks, "utf8")).toContain("- [ ]");
    await page.reload();
    const restored = await client.fetchAgent({ agentId: parent.id });
    expect(restored?.agent.features).toContainEqual(
      expect.objectContaining({ id: "openspec_planning", value: true }),
    );
    expect(restored?.agent.features).toContainEqual(
      expect.objectContaining({ id: "plan_mode", value: false }),
    );
    const url = page.url();
    await submitMessage(page, "Go ahead and implement add-greeting.");
    await expect(page.getByTestId("subagents-track-header")).toBeVisible({ timeout: 300_000 });
    await expect
      .poll(() => existsSync(path.join(workspace.repoPath, "greeting.txt")), { timeout: 300_000 })
      .toBe(true);
    await expect
      .poll(() => readFileSync(path.join(workspace.repoPath, "greeting.txt"), "utf8"), {
        timeout: 30_000,
      })
      .toBe("hello\n");
    await expect
      .poll(() => readFileSync(tasks, "utf8").includes("- [ ]"), { timeout: 120_000 })
      .toBe(false);
    expect(page.url()).toBe(url);
    await page.getByTestId("subagents-track-header").click();
    await expect(page.getByTestId(/^subagents-track-row-/).first()).toBeVisible();
    await page
      .getByTestId(/^subagents-track-row-/)
      .first()
      .click();
    await expect.poll(() => page.getByTestId(/^workspace-tab-/).count()).toBeGreaterThan(1);
  } finally {
    await workspace.cleanup();
  }
});
