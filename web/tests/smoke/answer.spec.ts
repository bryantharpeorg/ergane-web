/**
 * SC-006: the gate guarded the pane without walling it off.
 *
 * One run proves both halves. With the token configured — Playwright answers the
 * `WWW-Authenticate` challenge through `use.httpCredentials`, exactly as an
 * operator's browser does after being prompted once — the Desk loads, the one
 * verb reaches the factory for both answerable kinds, and the factory's word
 * comes back onto the item. Without it, the same Desk is one 401 carrying the
 * one refusal body and nothing of the floor.
 *
 * Every value the assertions compare against is read from the recording on disk
 * rather than typed here (constitution V): the ruling is the `outcome` key of
 * `fixtures/bridge/RESOLVED.json`, the demo default, and the pressed choice is
 * whichever one the delivered document put first.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const FIXTURES = fileURLToPath(new URL("../../../fixtures/", import.meta.url));

function recorded(relativePath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(FIXTURES + relativePath, "utf-8"));
}

test("the token guards the pane without walling it off", async ({
  page,
  browser,
  baseURL,
}) => {
  const requests: { method: string; url: string }[] = [];
  page.on("request", (req) => requests.push({ method: req.method(), url: req.url() }));

  await page.goto("/desk");
  await page.waitForSelector("section.attention article.item");

  // --- the Question: the factory's ruling, verbatim, on the item ------------
  const question = page.locator('article.item[data-kind="question"]');
  await expect(question).toBeVisible();
  await question.locator("textarea.reply").fill("the pane's one verb, from a browser");
  await question.locator(".answer-col button").click();

  // `PANE_DEMO_RULING` is unset for this server, so the demo reader replays
  // `fixtures/bridge/RESOLVED.json` — and the word asserted here is that file's
  // own `outcome`, read at run time so the recording stays the single source.
  const resolved = recorded("bridge/RESOLVED.json").outcome as string;
  await expect(question.locator(".ruling-line .ruling")).toHaveText(resolved);

  // --- the Escalation: pressed, and in flight until the factory says otherwise
  const escalation = page.locator('article.item[data-kind="escalation"]').first();
  const choices = escalation.locator(".answer-col button");
  const firstChoice = choices.first();
  const pressedPayload = await firstChoice.getAttribute("data-payload");
  expect(pressedPayload).not.toBeNull();
  await firstChoice.click();

  // A signal returns nothing, so an accepted press is *in flight* and stays
  // there until a factory read reports a fate (FR-008, D-P7). Every control on
  // the item is disabled while it is.
  await expect(escalation.locator(".answer-col button").first()).toBeDisabled();
  const choiceCount = await choices.count();
  for (let i = 0; i < choiceCount; i++) {
    await expect(choices.nth(i)).toBeDisabled();
  }
  await expect(escalation.locator(".ruling-line")).toContainText("in flight");

  // --- one verb, twice, and nothing else ------------------------------------
  const writes = requests.filter((r) => r.method !== "GET");
  expect(writes).toHaveLength(2);
  for (const write of writes) {
    expect(write.method).toBe("POST");
    expect(new URL(write.url).pathname).toMatch(/^\/api\/attention\/[^/]+\/answer$/);
  }

  // --- and the same Desk, in a browser holding no credential ----------------
  // `httpCredentials: undefined` is explicit because @playwright/test's `browser`
  // fixture otherwise hands `newContext` this project's `use` options. This
  // context never answers the challenge: it is what an operator who has not been
  // given the token actually sees, in a real browser, at the same URL.
  const anonymous = await browser.newContext({ httpCredentials: undefined });
  const anonymousPage = await anonymous.newPage();
  const refused = await anonymousPage.goto(`${baseURL}/desk`);
  expect(refused).not.toBeNull();
  expect(refused?.status()).toBe(401);
  // The two challenges are sent as two header fields, because Chromium will not
  // parse them combined and would then never prompt (see `pane/auth.py`). Joined,
  // they are byte-for-byte the one string contracts/api.md fixes.
  const challenges = (await refused?.headersArray() ?? [])
    .filter((header) => header.name.toLowerCase() === "www-authenticate")
    .map((header) => header.value);
  expect(challenges.join(", ")).toBe('Basic realm="ergane pane", Bearer');

  const body = await anonymousPage.evaluate(() => document.body.innerText);
  expect(body).toBe('{"error":"unauthorized"}');

  // Nothing of the floor rode out with the refusal: no attention item, no
  // correlation id, no route name (FR-014, US4-S2).
  const delivered = recorded("webhook/question.json").correlation_id as string;
  const rendered = await anonymousPage.content();
  expect(rendered).not.toContain(delivered);
  expect(await anonymousPage.locator("article.item").count()).toBe(0);
  expect(rendered).not.toContain("api/floor");
  await anonymous.close();
});
