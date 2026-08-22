import { test } from "node:test";
import assert from "node:assert/strict";
import { checkGuardrail, polishText } from "../src/ai_polish.js";

test("checkGuardrail passes when all protected facts are present", () => {
  const passed = checkGuardrail(
    "本書面は2024年1月10日付、金50万円の請求に関する通知書です（民法第724条）。",
    {
      dates: ["2024年1月10日"],
      amounts: ["金50万円"],
      articleNumbers: ["民法第724条"],
    }
  );
  assert.equal(passed, true);
});

test("checkGuardrail fails when a fact is missing (fail-safe)", () => {
  const passed = checkGuardrail(
    "本書面は請求に関する通知書です。",
    {
      dates: ["2024年1月10日"],
      amounts: ["金50万円"],
      articleNumbers: ["民法第724条"],
    }
  );
  assert.equal(passed, false);
});

test("polishText returns original text when useMock is true", async () => {
  const result = await polishText({
    text: "テスト本文",
    protectedFacts: {},
    useMock: true,
  });
  assert.equal(result.text, "テスト本文");
  assert.equal(result.usedAi, false);
  assert.equal(result.guardrailPassed, true);
});
