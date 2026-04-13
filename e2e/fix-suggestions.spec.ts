import { expect, test } from "@playwright/test";

test("renders copilot grounding and records feedback from the DAQ page", async ({ page }) => {
  let draftRequestBody: Record<string, unknown> | null = null;
  let feedbackRequestBody: Record<string, unknown> | null = null;

  await page.route("http://127.0.0.1:4010/api/emails/followup-needed", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        suggestions: [
          {
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
            evidence: [
              "Subject: We would like to invite you to come back",
              "Sender: WellsFargoHR <wellsfargoworkday@example.test>",
            ],
            actionConfidence: "high",
            draftAvailable: true,
          },
        ],
        meta: {},
      }),
    });
  });

  await page.route("http://127.0.0.1:4010/api/suggestions/states", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, actions: [] }),
    });
  });

  await page.route("http://127.0.0.1:4010/api/emails/apply-gate/history", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, history: [] }),
    });
  });

  await page.route("http://127.0.0.1:4010/api/emails/stored-emails", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        emails: [
          {
            id: "wf-email",
            thread_id: "wf-thread",
            subject: "We would like to invite you to come back",
            from: "WellsFargoHR <wellsfargoworkday@example.test>",
            date: "2026-04-10T12:00:00.000Z",
            category: "interviewed",
            company_name: "Wells Fargo",
            position: "Engineering Associate - DevOps Automation",
            applicationId: "wf-app",
          },
        ],
      }),
    });
  });

  await page.route("http://127.0.0.1:4010/api/suggestions/impressions", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, recorded: 1 }),
    });
  });

  await page.route("http://127.0.0.1:4010/api/suggestions/draft", async (route) => {
    draftRequestBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        draft: {
          subject: "Re: Wells Fargo Careers: Thank you for applying",
          body: "Hello,\n\nI wanted to follow up after submitting the assessment for the Engineering Associate - DevOps Automation role and ask whether there have been any updates on timing or next steps.\n\nThank you again for your time and consideration.\n\nBest,\n[Your Name]",
          context: "warm",
          contextLabel: "Warm follow-up",
          contextDescription: "Polite check-in that restates interest and asks about timing.",
          actionType: "follow_up",
          confidence: "medium",
          coachingPoints: [
            "Keep it under five sentences and ask for timing, not a decision.",
            "Re-state one concrete reason you fit the role before you close.",
          ],
          recipient: "Jordan Lee <jordan@example.test>",
          latestSender: "Wells Fargo Talent Acquisition <support@example.test>",
          sendStrategy: "reply_in_thread",
          sendStrategyLabel: "Reply to human contact",
          sendStrategyDescription: "Latest tracked email is from a shared mailbox. Reply in-thread and address Jordan to keep the original context.",
          evidence: [
            "Thread: Wells Fargo Careers: Thank you for applying",
            "Latest update: The Early Careers Engineering Assessment - Submission Confirmation",
            "Latest activity: 4/9/2026",
          ],
          threadPreview: "Hello, Thanks for completing the Early Careers Engineering Assessment. We have your submission to Wells Fargo.",
        },
      }),
    });
  });

  await page.route("http://127.0.0.1:4010/api/suggestions/feedback", async (route) => {
    feedbackRequestBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    });
  });

  await page.goto("/fix-suggestions");

  await expect(page.getByRole("heading", { name: "Daily Action Queue" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Send thank-you note to Wells Fargo" })).toBeVisible();

  await page.getByRole("button", { name: "Generate draft" }).click();

  await expect(page.getByText("Outreach Copilot")).toBeVisible();
  await expect(page.getByText("Suggested reply contact: Jordan Lee <jordan@example.test>")).toBeVisible();
  await expect(page.getByText("Latest sender in reply thread: Wells Fargo Talent Acquisition <support@example.test>")).toBeVisible();
  await expect(page.getByText("Latest update: The Early Careers Engineering Assessment - Submission Confirmation")).toBeVisible();
  await expect(page.getByText("Latest activity: 4/9/2026")).toBeVisible();
  await expect(page.getByText(/Thanks for completing the Early Careers Engineering Assessment\./)).toBeVisible();

  await page.getByText("Report draft issue").click();
  await page.getByTestId("copilot-feedback-wrong_grounding").click();

  await expect(page.getByText("Latest feedback saved: Wrong grounding")).toBeVisible();

  expect(draftRequestBody).toEqual(
    expect.objectContaining({
      threadId: "wf-thread",
      actionType: "thank_you",
      emailId: "wf-email",
      applicationId: "wf-app",
      suggestionSource: "email_followup",
    }),
  );

  expect(feedbackRequestBody).toEqual(
    expect.objectContaining({
      threadId: "wf-thread",
      actionType: "thank_you",
      feedbackLabel: "wrong_grounding",
      tone: "post_interview",
      emailId: "wf-email",
      applicationId: "wf-app",
      suggestionSource: "email_followup",
      feedback: {
        surface: "fix_suggestions",
      },
      draft: expect.objectContaining({
        recipient: "Jordan Lee <jordan@example.test>",
        latestSender: "Wells Fargo Talent Acquisition <support@example.test>",
        sendStrategyLabel: "Reply to human contact",
      }),
    }),
  );
});
