import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import type { DaemonClient } from "@getpaseo/client/internal/daemon-client";
import { test, expect } from "../support/fixtures";
import { seedWorkspace } from "../support/helpers/seed-client";
import { clickNewChat, gotoWorkspace } from "../support/helpers/launcher";
import { composerLocator, submitMessage } from "../support/helpers/composer";
import { drillIntoProvider, openModelPicker } from "../support/helpers/agent-profiles";

test.use({
  e2eInjectPaseoTools: true,
  e2eDaemonConfig: {
    version: 1,
    agents: { providers: { codex: { command: [path.join(homedir(), ".local", "bin", "codex")] } } },
  },
});
test.describe.configure({ timeout: 600_000 });
const OPENSPEC_SKILL_NAMES = [
  "openspec-apply-change",
  "openspec-archive-change",
  "openspec-explore",
  "openspec-propose",
  "openspec-sync-specs",
  "openspec-update-change",
];

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
    execFileSync("openspec", ["init", "--tools", "none", "--profile", "core"], {
      cwd: workspace.repoPath,
      stdio: "ignore",
    });
    expect(existsSync(path.join(workspace.repoPath, ".agents", "skills"))).toBe(false);
    await expect
      .poll(
        async () =>
          (await client.getProvidersSnapshot({ cwd: workspace.repoPath })).entries.find(
            (entry) => entry.provider === "codex",
          )?.status,
        { timeout: 60_000 },
      )
      .toBe("ready");
    const snapshot = await client.getProvidersSnapshot({ cwd: workspace.repoPath });
    const provider = snapshot.entries.find((entry) => entry.provider === "codex");
    const model = provider?.models?.find((candidate) => candidate.isDefault);
    if (!model) throw new Error("Codex did not report its default model");
    await gotoWorkspace(page, workspace.workspaceId);
    await clickNewChat(page);
    await openModelPicker(page);
    await page.getByRole("dialog").getByRole("button", { name: "Back", exact: true }).click();
    await drillIntoProvider(page, "codex");
    await page
      .getByTestId("combobox-desktop-container")
      .getByText(model.label, { exact: true })
      .click();
    await page.getByTestId("mode-control").filter({ visible: true }).click();
    await page
      .getByTestId("combobox-desktop-container")
      .getByText(/^Full access$/i)
      .click();
    const composer = composerLocator(page);
    const toggle = page.getByTestId("agent-feature-openspec_planning").filter({ visible: true });
    const popover = page.getByTestId("composer-autocomplete-popover");
    const expectedSkillLabels = OPENSPEC_SKILL_NAMES.map((name) => `/${name}`);
    await expect(toggle).toBeVisible();
    await composer.fill("/openspec");
    await expect(popover.getByText(/^\/openspec-/)).toHaveCount(0);
    await toggle.click();
    await expect
      .poll(
        async () => [...new Set(await popover.getByText(/^\/openspec-/).allTextContents())].sort(),
        { timeout: 60_000 },
      )
      .toEqual(expectedSkillLabels);
    await toggle.click();
    await expect(popover.getByText(/^\/openspec-/)).toHaveCount(0);
    expect(
      (await client.fetchAgents({ scope: "active" })).entries.filter(
        (entry) => entry.agent.workspaceId === workspace.workspaceId,
      ),
    ).toHaveLength(0);
    await toggle.click();
    await expect
      .poll(
        async () => [...new Set(await popover.getByText(/^\/openspec-/).allTextContents())].sort(),
        { timeout: 60_000 },
      )
      .toEqual(expectedSkillLabels);
    await submitMessage(
      page,
      "Use openspec-propose to propose a tiny change named add-greeting: create greeting.txt containing exactly hello followed by a newline. This is a disposable synthetic acceptance project with a local bare remote. Keep the proposal concise.",
    );
    const tasks = path.join(workspace.repoPath, "openspec", "changes", "add-greeting", "tasks.md");
    await expect.poll(() => existsSync(tasks), { timeout: 300_000 }).toBe(true);
    const parent = (await client.fetchAgents({ scope: "active" })).entries.find(
      (entry) => entry.agent.workspaceId === workspace.workspaceId,
    )?.agent;
    if (!parent) throw new Error("Draft submission did not create the parent agent");
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
    expect(
      (await client.listCommands(parent.id)).commands
        .filter((command) => command.name.startsWith("openspec-"))
        .map((command) => command.name),
    ).toEqual(OPENSPEC_SKILL_NAMES);
    const url = page.url();
    const applySkill = path.join(
      homedir(),
      ".local",
      "share",
      "openspec",
      "skills",
      "openspec-apply-change",
      "SKILL.md",
    );
    await submitMessage(
      page,
      `Go ahead and implement add-greeting. Delegate implementation to a fresh Codex child in this workspace. Use fork_turns none for a native child. Include this explicit task for the child: read and follow ${applySkill} to implement add-greeting, mark its tasks complete, and report back. Keep decisions and follow-up here.`,
    );
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
