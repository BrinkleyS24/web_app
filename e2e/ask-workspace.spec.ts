import { expect, test } from "@playwright/test";

const listAnswer = {
  success: true, answerKind: "list", answer: "218 applications have no reply.",
  applications: [], basis: { applications: 543, earliestTrackedOn: "2025-11-15" },
  list: { kind: "no_reply", minDays: 14, total: 218, items: Array.from({ length: 218 }, (_, i) => ({
    ref: `R${i}`, company: `Example ${String(i).padStart(3, "0")}`, role: i === 217 ? "Long role title for an application with several teams and responsibilities" : "Analyst",
    appliedOn: "2026-01-01", lastUpdateOn: "2026-01-01", daysSinceLastUpdate: 300 - i, stage: "quiet", threadId: `thread-${i}`,
  })) },
};

for (const width of [320, 390, 1440]) test(`Ask's complete list is readable, navigable and source-linked at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); const errors: string[] = []; let questions = 0;
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = { success: true };
    if (path === "/api/user") body = { success: true, user: { plan: "premium", isAdmin: false }, plan: "premium" };
    if (path.endsWith("/suggestions/queue")) body = { success: true, queue: { doToday: [], thisWeek: [], later: [], resolvedActions: [] } };
    if (path === "/api/ask") { questions++; body = listAnswer; }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.goto("/ask");
  await expect(page.getByRole("heading", { level: 1, name: "Ask Applendium" })).toBeVisible();
  await page.getByRole("button", { name: "Who hasn't replied in 2 weeks?", exact: true }).click();
  await expect(page.getByRole("heading", { name: "218 applications with no tracked reply" })).toBeVisible();
  await expect(page.getByTestId("ask-result-row")).toHaveCount(5);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const summary = await page.getByRole("heading", { name: "218 applications with no tracked reply" }).boundingBox();
  expect(summary!.y).toBeLessThan(700);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("6–10 of 218 applications", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Applications in this answer" })).toBeFocused();
  await page.getByRole("searchbox").fill("Example 217");
  await expect(page.getByTestId("ask-result-row")).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Open in Gmail" })).toHaveAttribute("href", "https://mail.google.com/mail/u/0/#all/thread-217");
  await page.getByRole("searchbox").fill("missing company");
  await expect(page.getByText("No company or role matches your filter.")).toBeVisible();
  await page.getByRole("button", { name: "Clear filter" }).click();
  await expect(page.getByTestId("ask-result-row")).toHaveCount(5);
  expect(questions).toBe(1); expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("Ask recovers a failed question, keeps the draft editable and exposes email evidence without executing it", async ({ page }) => {
  let attempts = 0;
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname; let body: unknown = { success: true };
    if (path === "/api/ask") {
      attempts++;
      if (attempts === 1) return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ success: false, code: "ask_unavailable", error: "Ask is temporarily unavailable." }) });
      body = { success: true, answer: "Review this draft before sending.", applications: [], draft: { subject: "Follow-up", body: "Hello, could you share an update?" }, quotes: [{ ref: "Q1", company: "Example", date: "2026-11-01", passage: "<img src=x onerror=alert(1)> We received your application.", threadId: "q1" }] };
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.goto("/ask"); await page.getByLabel("Your question", { exact: true }).fill("Draft a follow-up"); await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("We couldn't answer");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByLabel("Message", { exact: true })).toHaveValue("Hello, could you share an update?");
  await page.getByLabel("Message", { exact: true }).fill("My edited message");
  await page.getByText(/What Example wrote/).click();
  await expect(page.getByRole("blockquote")).toContainText("<img src=x onerror=alert(1)>");
  await expect(page.locator("blockquote img")).toHaveCount(0);
  expect(attempts).toBe(2);
});
