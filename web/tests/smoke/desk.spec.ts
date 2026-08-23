import { expect, test } from "@playwright/test";

function timeLeftText(expiresAt: string, reference: string): string {
  const diffMs = new Date(expiresAt).getTime() - new Date(reference).getTime();
  if (diffMs <= 0) return "expired";
  const totalSeconds = Math.floor(diffMs / 1000);
  const hh = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const ss = String(totalSeconds % 60).padStart(2, "0");
  return `−${hh}:${mm}:${ss}`;
}

test("the Desk renders the fixture floor and issues one verb and no other", async ({
  page,
  request,
}) => {
  const requests: { method: string; url: string }[] = [];
  page.on("request", (req) => requests.push({ method: req.method(), url: req.url() }));

  await page.goto("/desk");
  await page.waitForSelector("section.attention article.item");

  const floorResponse = await request.get("/api/floor");
  const floorDoc = (await floorResponse.json()) as {
    reference_instant: string | null;
    attention: {
      items: {
        kind: string;
        expires_at: string | null;
        actions: { label: string; payload: string }[];
      }[];
    };
  };
  const referenceInstant = floorDoc.reference_instant ?? new Date().toISOString();

  const body = await page.evaluate(() => document.body.innerHTML);
  const lastItemIndex = body.lastIndexOf('article class="item');
  const firstFloorIndex = body.indexOf('section class="floor"');
  expect(lastItemIndex).toBeGreaterThan(-1);
  expect(firstFloorIndex).toBeGreaterThan(-1);
  expect(lastItemIndex).toBeLessThan(firstFloorIndex);

  const items = page.locator("section.attention article.item");
  const count = await items.count();
  for (let i = 0; i < count; i++) {
    const item = items.nth(i);
    const kind = await item.getAttribute("data-kind");
    // Spec 003 US1 seeds the demo floor from all three recorded deliveries, so
    // the Notice the same notify adapter carries renders here too.
    expect(kind).toMatch(/escalation|question|notice/);
    if (kind === "escalation") {
      const expiresAt = await item.getAttribute("data-expires-at");
      expect(expiresAt).not.toBeNull();
      await expect(item.locator(".clock")).toHaveText(
        timeLeftText(expiresAt as string, referenceInstant),
      );
    }
  }

  const question = page.locator('article.item[data-kind="question"]');
  await expect(question).toBeVisible();
  await expect(question.locator(".no-deadline")).toHaveText("no deadline from the factory");

  // A Notice reads, and asks for nothing: no clock, and no control at all
  // (DESIGN.md § Components › Attention Item).
  const notice = page.locator('article.item[data-kind="notice"]');
  await expect(notice).toBeVisible();
  await expect(notice.locator(".kind")).toHaveText("Notice");
  await expect(notice.locator(".no-clock")).toHaveText("no clock");
  await expect(notice.locator(".asks-nothing")).toHaveText(
    "Asks for nothing; no answer exists.",
  );
  for (const control of ["button", "input", "textarea", "select", "form"]) {
    expect(await notice.locator(control).count()).toBe(0);
  }

  const spend = page.locator("section.spend");
  await expect(spend.locator("h2")).toHaveText(/spend to date/i);
  await expect(spend.locator(".unknown").first()).toHaveText("unknown");
  await expect(spend).not.toContainText(/live/i);

  const pagedRow = page.locator('article.epic[data-scene="paged-while-verifying"]');
  await expect(pagedRow).toBeVisible();
  const pagedChev = pagedRow.locator(".chev[data-paged]");
  await expect(pagedChev).toBeVisible();
  await expect(pagedChev).toHaveAttribute("data-undeclared", "true");
  await expect(pagedChev).toHaveAttribute("data-state", "VERIFYING");

  // Spec 003 US2 gives the Desk its one verb, so 001's zero-write sweep becomes
  // the one-write sweep the pane keeps forever (plan D-P13): the full run may
  // issue non-GET requests to the answer route and to nothing else. This is the
  // control against the defect D-001 forbids — a convenience write added
  // anywhere on the Desk shows up here as a request this filter does not
  // permit, however small and however well meant (US2-S4).
  const writes = requests.filter((r) => r.method !== "GET");
  for (const write of writes) {
    expect(write.method).toBe("POST");
    expect(new URL(write.url).pathname).toMatch(/^\/api\/attention\/[^/]+\/answer$/);
  }

  // And the delivered Escalation offers exactly the choices the factory sent —
  // one control per delivered choice, its face and its payload verbatim
  // (US2-S2, FR-007).
  const escalation = page.locator('article.item[data-kind="escalation"]').first();
  const delivered = (
    floorDoc.attention.items.find((item) => item.kind === "escalation") as {
      actions: { label: string; payload: string }[];
    }
  ).actions;
  const choices = escalation.locator(".answer-col button");
  await expect(choices).toHaveCount(delivered.length);
  for (let i = 0; i < delivered.length; i++) {
    await expect(choices.nth(i).locator(".face")).toHaveText(delivered[i].label);
    await expect(choices.nth(i).locator(".payload")).toHaveText(delivered[i].payload);
  }

  // A Question offers the reply field and one Answer button, and nothing else.
  await expect(question.locator("textarea.reply")).toBeVisible();
  await expect(question.locator(".answer-col button")).toHaveCount(1);
});
