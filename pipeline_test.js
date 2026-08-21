// naiyo_syoumei_integration_test.js は本ファイルに統合済み（重複ファイルのため廃止）。
//
// TODO: rule_engine.js / templates.js に前チャットの本体コードを貼り付けたら、
// 4シナリオ分のルールエンジン→テンプレート→AI調整の結合テストをここに追加すること。
// ai_polish.js のガードレール検証は実装済みのため、そちらのテストは動作する。

import { test } from "node:test";
import assert from "node:assert/strict";
import { checkGuardrail, polishText } from "../src/ai_polish.js";

test("checkGuardrail: すべての保護対象が出力に含まれていれば true", () => {
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

test("checkGuardrail: 事実が一つでも欠落していれば false（フェイルセーフ）", () => {
  const passed = checkGuardrail(
    "本書面は請求に関する通知書です。", // 日付・金額・条文番号が消えている
    {
      dates: ["2024年1月10日"],
      amounts: ["金50万円"],
      articleNumbers: ["民法第724条"],
    }
  );
  assert.equal(passed, false);
});

test("polishText: useMock=true のときはAPIを呼ばず原文をそのまま返す", async () => {
  const result = await polishText({
    text: "テスト本文",
    protectedFacts: {},
    useMock: true,
  });
  assert.equal(result.text, "テスト本文");
  assert.equal(result.usedAi, false);
  assert.equal(result.guardrailPassed, true);
});
