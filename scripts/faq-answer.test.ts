import assert from "node:assert/strict";
import test from "node:test";
import { parseFaqAnswer } from "../lib/faq-answer";

test("accepts an answer when evidence was supplied", () => {
  assert.deepEqual(
    parseFaqAnswer({
      data: { content: '{"answer":"The demo fixture lists Tajweed.","handoff":false}' },
    }, 1),
    { answer: "The demo fixture lists Tajweed.", handoff: false },
  );
});

test("preserves supported partial answers while flagging missing details for handoff", () => {
  assert.deepEqual(
    parseFaqAnswer({
      data: {
        content: JSON.stringify({
          answer: "The fixture lists demo monthly fees; it does not specify registration charges, so a representative must confirm them.",
          handoff: true,
        }),
      },
    }, 1),
    {
      answer: "The fixture lists demo monthly fees; it does not specify registration charges, so a representative must confirm them.",
      handoff: true,
    },
  );
});

test("always hands off when evidence is absent, even if AI returns an answer", () => {
  assert.equal(
    parseFaqAnswer({ content: '{"answer":"Unsupported policy","handoff":false}' }, 0).handoff,
    true,
  );
});

test("hands off for malformed or incomplete AI output", () => {
  assert.equal(parseFaqAnswer({ data: { content: "not JSON" } }, 2).handoff, true);
  assert.equal(parseFaqAnswer({ data: { content: '{"answer":"No flag"}' } }, 2).handoff, true);
  assert.equal(parseFaqAnswer({ data: { content: '{"answer":"","handoff":false}' } }, 2).handoff, true);
});

test("accepts JSON wrapped in a code fence from the configured AI service", () => {
  assert.deepEqual(
    parseFaqAnswer({
      content: '```json\n{"answer":"Demo information only.","handoff":false}\n```',
    }, 1),
    { answer: "Demo information only.", handoff: false },
  );
});

test("preserves a model handoff on conflicting evidence", () => {
  assert.deepEqual(
    parseFaqAnswer({
      content: '{"answer":"The documents conflict; please ask a representative to confirm.","handoff":true}',
    }, 2),
    { answer: "The documents conflict; please ask a representative to confirm.", handoff: true },
  );
});
