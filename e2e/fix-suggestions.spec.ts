import { expect, test, type Page } from "@playwright/test";
import { TONES } from "../src/components/premium/tone";

/**
 * Next Actions (/fix-suggestions): the draft panel, end to end against mocked API routes.
 *
 * The narrow-width cases are the regression check the founder asked for after the Codex audit
 * (2026-10-06): at 390 px the open draft and its feedback panel pushed the page to 536-613 px wide.
 * The fix lets the layout shrink and long text wrap; nothing is clipped. These tests open the
 * draft, open the feedback controls, use long unbroken content, and require that the page never
 * scrolls sideways, every control sits inside the screen, and no text is cut off.
 */

type DraftContent = {
  subject: string;
  recipient: string;
  latestSender: string;
  evidence: string[];
  threadPreview: string;
  body: string;
};

const SHORT: DraftContent = {
  subject: "Re: Wells Fargo Careers: Thank you for applying",
  recipient: "Jordan Lee <jordan@example.test>",
  latestSender: "Wells Fargo Talent Acquisition <support@example.test>",
  evidence: [
    "Thread: Wells Fargo Careers: Thank you for applying",
    "Latest update: The Early Careers Engineering Assessment - Submission Confirmation",
    "Latest activity: 4/9/2026",
  ],
  threadPreview: "Hello, Thanks for completing the Early Careers Engineering Assessment. We have your submission to Wells Fargo.",
  body: "Hello,\n\nI wanted to follow up after submitting the assessment for the Engineering Associate - DevOps Automation role and ask whether there have been any updates on timing or next steps.\n\nThank you again for your time and consideration.\n\nBest,\n[Your Name]",
};

// Real mail has these: a shared-mailbox address with no break opportunities, a forwarded subject
// chain, and a tracking link.
const LONG: DraftContent = {
  subject: "Re: Fwd: Re: Wells Fargo Careers - Engineering Associate - DevOps Automation (Requisition R-2026-0042-EARLY-CAREERS-TECHNOLOGY) - Next steps after your Early Careers Engineering Assessment",
  recipient: "Jordan Alexandria Lee-Montgomery <jordan.alexandria.lee-montgomery.talent-acquisition@earlycareers-recruiting.wellsfargo-careers.example.test>",
  latestSender: "Wells Fargo Early Careers Talent Acquisition Shared Mailbox <noreply-earlycareers-talentacquisition-workday-notifications@myworkday-wellsfargo.example.test>",
  evidence: [
    "Thread: Re: Fwd: Wells Fargo Careers - Engineering Associate - DevOps Automation (Requisition R-2026-0042-EARLY-CAREERS-TECHNOLOGY)",
    "Latest update: https://wellsfargo.wd5.myworkdayjobs.example.test/en-US/WellsFargoJobs/job/Charlotte-NC/Engineering-Associate---DevOps-Automation_R-2026-0042?source=email&utm_campaign=assessment_confirmation",
    "Latest activity: 4/9/2026",
  ],
  threadPreview: "Hello, Thanks for completing the Early Careers Engineering Assessment. Track your application at https://wellsfargo.wd5.myworkdayjobs.example.test/en-US/WellsFargoJobs/userHome?redirect=/en-US/WellsFargoJobs/job/R-2026-0042&utm_source=assessment_confirmation_email_notification",
  body: `Hello Jordan,\n\nI wanted to follow up on the Engineering Associate - DevOps Automation role (R-2026-0042-EARLY-CAREERS-TECHNOLOGY) after the assessment: https://wellsfargo.wd5.myworkdayjobs.example.test/en-US/WellsFargoJobs/job/Charlotte-NC/Engineering-Associate---DevOps-Automation_R-2026-0042\n\nThank you,\n[Your Name]`,
};

type Captured = {
  draftRequestBody: Record<string, unknown> | null;
  feedbackRequestBody: Record<string, unknown> | null;
  impressionBodies: Record<string, unknown>[];
  pageErrors: string[];
};

async function mockApi(page: Page, content: DraftContent): Promise<Captured> {
  const captured: Captured = { draftRequestBody: null, feedbackRequestBody: null, impressionBodies: [], pageErrors: [] };
  page.on("pageerror", (error) => captured.pageErrors.push(error.message));

  // Anything this page reads that the test does not care about answers empty (registered first, so
  // the specific routes below win).
  await page.route("**/api/**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
  });

  const followupAction = {
    id: "queue-followup-1",
    logicalKey: "followup:wf-thread",
    dedupeKey: "followup:wf-thread:v1",
    primaryEntityId: "wf-thread",
    evidenceVersion: "v1",
    actionType: "thank_you",
    actionCategory: "communication",
    title: "Send thank-you note to Wells Fargo",
    whyNow: "Interview thank-you notes are most useful while the conversation is still fresh.",
    targetOutcome: "Increase the odds of a recruiter response.",
    effortMinutes: 5,
    urgencyLevel: "high",
    confidenceLevel: "strong",
    source: "followup_engine",
    status: "open",
    effectiveStatus: "open",
    createdAt: "2026-04-10T12:00:00.000Z",
    evidence: [`Subject: ${content.subject}`, `Sender: ${content.latestSender}`],
    threadId: "wf-thread",
    emailId: "wf-email",
    applicationId: "wf-app",
    suggestionSource: "email_followup",
    queueSource: "followup",
    intent: "SEND_THANK_YOU",
    intentLabel: "Thank-you",
    playbook: ["Open the source thread and verify the company, role, and interview context first."],
    sourceLabel: "Outreach task",
    draftEligible: true,
    routeHref: "/fix-suggestions",
    routeLabel: "Open queue",
    stageLabel: "Outreach",
    company: "Wells Fargo",
  };

  await page.route("**/api/emails/followup-needed", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        suggestions: [{
          threadId: "wf-thread",
          emailId: "wf-email",
          applicationId: "wf-app",
          title: "Send thank-you note to Wells Fargo",
          description: "Send a personalized thank-you note within 24 hours of your interview with Wells Fargo.",
          company: "Wells Fargo",
          actionType: "thank_you",
          suggestionSource: "email_followup",
          urgency: "high",
          daysAgo: 1,
          estimatedTime: "5 mins",
          category: "interviewed",
          whyNow: "Interview thank-you notes are most useful while the conversation is still fresh.",
          evidence: [`Subject: ${content.subject}`, `Sender: ${content.latestSender}`],
          actionConfidence: "high",
          draftAvailable: true,
        }],
        meta: {},
      }),
    });
  });

  await page.route("**/api/suggestions/queue", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        queue: {
          now: "2026-04-11T12:00:00.000Z",
          doToday: [followupAction],
          thisWeek: [],
          later: [],
          blocked: [],
          dismissed: [],
          expired: [],
          done: [],
          emptyState: null,
          resolvedActions: [followupAction],
        },
      }),
    });
  });

  await page.route("**/api/suggestions/queue/actions/impression", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    captured.impressionBodies.push(body);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, state: "active", logicalKey: body.logicalKey, dedupeKey: body.dedupeKey, wasStale: false, displayCount: 1 }),
    });
  });

  await page.route("**/api/suggestions/states", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, actions: [] }) });
  });

  await page.route("**/api/emails/apply-gate/history", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, history: [] }) });
  });

  await page.route("**/api/emails/stored-emails", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        emails: [{
          id: "wf-email",
          thread_id: "wf-thread",
          subject: content.subject,
          from: content.latestSender,
          date: "2026-04-10T12:00:00.000Z",
          category: "interviewed",
          company_name: "Wells Fargo",
          position: "Engineering Associate - DevOps Automation",
          applicationId: "wf-app",
        }],
      }),
    });
  });

  await page.route("**/api/suggestions/draft", async (route) => {
    captured.draftRequestBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        draft: {
          subject: content.subject,
          body: content.body,
          context: "warm",
          contextLabel: "Warm follow-up",
          contextDescription: "Polite check-in that restates interest and asks about timing.",
          actionType: "follow_up",
          confidence: "medium",
          coachingPoints: [
            "Keep it under five sentences and ask for timing, not a decision.",
            "Re-state one concrete reason you fit the role before you close.",
          ],
          recipient: content.recipient,
          latestSender: content.latestSender,
          sendStrategy: "reply_in_thread",
          sendStrategyLabel: "Reply to human contact",
          sendStrategyDescription: "Latest tracked email is from a shared mailbox. Reply in-thread and address Jordan to keep the original context.",
          evidence: content.evidence,
          threadPreview: content.threadPreview,
        },
      }),
    });
  });

  await page.route("**/api/suggestions/feedback", async (route) => {
    captured.feedbackRequestBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
  });

  return captured;
}

async function openDraftAndFeedback(page: Page) {
  await page.goto("/fix-suggestions", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Next Actions", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Send thank-you note to Wells Fargo" })).toBeVisible();
  await page.getByRole("button", { name: "Draft thank-you note" }).click();
  await expect(page.getByText("Your draft")).toBeVisible();
  await expect(page.getByTestId("draft-recipient")).toBeVisible();
  await page.getByText("Something wrong with this draft?").click();
  await expect(page.getByTestId("copilot-feedback-wrong_grounding")).toBeVisible();
}

test("the draft shows who it goes to and what it is based on, and records feedback", async ({ page }) => {
  const captured = await mockApi(page, SHORT);
  await openDraftAndFeedback(page);

  await expect(page.getByText("Suggested reply contact: Jordan Lee <jordan@example.test>")).toBeVisible();
  await expect(page.getByText("Latest sender in conversation: Wells Fargo Talent Acquisition <support@example.test>")).toBeVisible();
  await expect(page.getByText("Latest update: The Early Careers Engineering Assessment - Submission Confirmation")).toBeVisible();
  await expect(page.getByText(/Thanks for completing the Early Careers Engineering Assessment\./)).toBeVisible();
  await expect.poll(() => captured.impressionBodies.length).toBeGreaterThan(0);

  await page.getByTestId("copilot-feedback-wrong_grounding").click();
  await expect(page.getByText("Latest feedback saved: Wrong facts")).toBeVisible();

  expect(captured.draftRequestBody).toEqual(expect.objectContaining({
    threadId: "wf-thread",
    actionType: "thank_you",
    emailId: "wf-email",
    applicationId: "wf-app",
    suggestionSource: "email_followup",
  }));
  expect(captured.feedbackRequestBody).toEqual(expect.objectContaining({
    threadId: "wf-thread",
    feedbackLabel: "wrong_grounding",
    draft: expect.objectContaining({
      recipient: "Jordan Lee <jordan@example.test>",
      latestSender: "Wells Fargo Talent Acquisition <support@example.test>",
    }),
  }));
  expect(captured.pageErrors).toEqual([]);
});

for (const width of [320, 390]) {
  test(`at ${width} px the open draft and its feedback controls fit, with long content and nothing cut off`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const captured = await mockApi(page, LONG);
    await openDraftAndFeedback(page);

    // The page never scrolls sideways.
    const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(pageWidth, `page is ${pageWidth}px wide on a ${width}px screen`).toBeLessThanOrEqual(width);

    // Every draft control sits inside the screen, so it can be reached without sideways scrolling.
    const controls = [
      page.getByRole("button", { name: "Copy draft" }),
      page.getByRole("button", { name: "Copy subject + body" }),
      page.getByText("Something wrong with this draft?"),
      ...["helpful", "too_generic", "wrong_recipient", "wrong_grounding", "wrong_tone"].map((value) => page.getByTestId(`copilot-feedback-${value}`)),
    ];
    for (const control of controls) {
      if (await control.count() === 0) continue;
      const box = await control.first().boundingBox();
      expect(box, "control is rendered").not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    }

    // Long text wraps instead of being cut off: each block shows all of its content.
    for (const testId of ["draft-subject", "draft-recipient", "draft-latest-sender"]) {
      const clipped = await page.getByTestId(testId).evaluate((element) => ({
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        ellipsis: getComputedStyle(element).textOverflow === "ellipsis",
      }));
      expect(clipped.ellipsis, `${testId} uses an ellipsis`).toBe(false);
      expect(clipped.scrollWidth, `${testId} is wider than its box`).toBeLessThanOrEqual(clipped.clientWidth + 1);
    }
    await expect(page.getByTestId("draft-recipient")).toContainText(LONG.recipient);

    // And the controls work where they are.
    await page.getByTestId("copilot-feedback-wrong_recipient").click();
    await expect(page.getByText("Latest feedback saved: Wrong person")).toBeVisible();
    expect(captured.pageErrors).toEqual([]);
  });
}

test('paid status text meets normal-text contrast on its actual tinted backgrounds', async ({ page }) => {
  await mockApi(page, SHORT);
  await openDraftAndFeedback(page);
  // Resolve the compiled CSS in Chromium, including transparent tint composition. This checks
  // the common chip palette, not a claim of complete page accessibility.
  const ratios = await page.evaluate((tones) => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true })!;
    canvas.width = canvas.height = 1;
    const rgba = (color: string) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data];
    };
    const composite = (foreground: number[], background: number[]) => foreground.slice(0, 3).map((channel, index) => channel * foreground[3] / 255 + background[index] * (1 - foreground[3] / 255));
    const luminance = (color: number[]) => color.map((channel) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    const results: Array<{ tone: string; mode: string; ratio: number }> = [];
    const wasDark = document.documentElement.classList.contains('dark');
    for (const mode of ['light', 'dark']) {
      document.documentElement.classList.toggle('dark', mode === 'dark');
      for (const tone of mode === 'light' ? ['brand', 'positive', 'attention'] : ['attention']) {
        const card = document.createElement('div');
        card.className = 'bg-card';
        const chip = document.createElement('span');
        chip.className = tones[tone as keyof typeof tones].chip;
        chip.textContent = tone;
        card.append(chip);
        document.body.append(card);
        const background = composite(rgba(getComputedStyle(chip).backgroundColor), rgba(getComputedStyle(card).backgroundColor));
        const foreground = composite(rgba(getComputedStyle(chip).color), background);
        const a = luminance(foreground), b = luminance(background);
        results.push({ tone, mode, ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) });
        card.remove();
      }
    }
    document.documentElement.classList.toggle('dark', wasDark);
    return results;
  }, TONES);
  for (const result of ratios) expect(result.ratio, `${result.mode} ${result.tone}: ${result.ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
});
