/**
 * The one non-GET request the pane issues, and the only file that issues it.
 *
 * Two calls, one route: a Question carries the operator's text, an Escalation
 * carries one of the payloads the factory delivered, byte for byte. Neither
 * function reads the answer it gets back — the ruling and the signal word are
 * the factory's, rendered verbatim wherever they land, and interpreting one
 * here would be the pane deciding what the factory meant (FR-006, FR-008).
 *
 * `web/tests/unit/noVerb.test.ts` sweeps `web/src/` for exactly this: one write,
 * from this file, to this route, and nothing else anywhere (plan D-P13).
 */

/** What `POST /api/attention/{id}/answer` returns, unread by this module. */
export interface AnswerResult {
  kind: string;
  ruling?: string;
  signal?: string;
}

async function post(id: string, body: unknown): Promise<AnswerResult> {
  const response = await fetch(`/api/attention/${encodeURIComponent(id)}/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await response.json()) as AnswerResult;
}

/** Submit a Question's free text. The factory rules; this carries the ruling back. */
export function answerQuestion(id: string, text: string): Promise<AnswerResult> {
  return post(id, { text });
}

/** Press one delivered choice. The payload is the factory's, never composed here. */
export function pressChoice(id: string, payload: string): Promise<AnswerResult> {
  return post(id, { payload });
}
