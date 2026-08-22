import { test } from "node:test";
import assert from "node:assert/strict";
import { checkGuardrail, polishText } from "../src/ai_polish.js";
import { evaluateScenario } from "../src/rule_engine.js";
import { buildDocument } from "../src/templates.js";

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

// ---------------------------------------------------------------
// 結合テスト: rule_engine → templates → ai_polish(mock)
// ---------------------------------------------------------------

const COMMON = { senderName: "山田太郎", recipientName: "鈴木一郎", documentDate: "2026-08-22" };

test("シナリオ1: 消滅時効の援用（成立）", async () => {
  const evaluation = evaluateScenario("jikou_enyou", {
    companyName: "アコム",
    contractNo: "A-12345",
    lastTransactionDate: "2019-01-15",
    debtAmount: 500000,
    hasInterruption: false,
  });
  assert.equal(evaluation.blocked, false);
  assert.equal(evaluation.templateId, "jikou_enyou_v1");

  const doc = buildDocument(evaluation, COMMON);
  assert.match(doc.text, /民法第166条/);
  assert.match(doc.text, /2019-01-15/);
  assert.deepEqual(doc.protectedFacts.articleNumbers, ["民法第166条"]);
  assert.ok(doc.protectedFacts.dates.includes("2019-01-15"));

  const polished = await polishText({ text: doc.text, protectedFacts: doc.protectedFacts, useMock: true });
  assert.equal(polished.guardrailPassed, true);
});

test("シナリオ1: 時効未成立はブロックされる", () => {
  const evaluation = evaluateScenario("jikou_enyou", {
    companyName: "アコム",
    contractNo: "A-12345",
    lastTransactionDate: "2024-01-15",
    debtAmount: 500000,
    hasInterruption: false,
  });
  assert.equal(evaluation.blocked, true);
  assert.equal(evaluation.pattern, "not_yet_expired");
});

test("シナリオ2: 不倫慰謝料（証拠あり→パターンA・断定的請求文）", () => {
  const evaluation = evaluateScenario("furin_isharyou", {
    target: "partner",
    discoveryDate: "2025-06-01",
    evidenceTypes: ["line", "photo"],
    marriageYears: 8,
    requestedAmount: 1500000,
  });
  assert.equal(evaluation.templateId, "furin_isharyou_patternA_v1");

  const doc = buildDocument(evaluation, COMMON);
  assert.match(doc.text, /金1,500,000円/);
  assert.match(doc.text, /民法第709条及び第710条/);
});

test("シナリオ2: 不倫慰謝料（証拠なし→パターンB・協議申入れ文にトーンダウン）", () => {
  const evaluation = evaluateScenario("furin_isharyou", {
    target: "partner",
    discoveryDate: "2025-06-01",
    evidenceTypes: [],
    marriageYears: 8,
    requestedAmount: 1500000,
  });
  assert.equal(evaluation.templateId, "furin_isharyou_patternB_v1");
  assert.equal(evaluation.warnings.length, 1);

  const doc = buildDocument(evaluation, COMMON);
  // パターンBでは金額を文面に反映しない（断定を避けるため）
  assert.doesNotMatch(doc.text, /1,500,000/);
  assert.deepEqual(doc.protectedFacts.amounts, []);
});

test("シナリオ3: 残業代（時効まで6ヶ月以内は至急発送の警告）", () => {
  const evaluation = evaluateScenario("zangyou_pawahara", {
    companyName: "株式会社テスト",
    claimTypes: ["overtime"],
    lastPayDate: "2023-10-01",
    unpaidAmount: 800000,
  });
  assert.equal(evaluation.blocked, false);
  assert.equal(evaluation.pattern, "urgent_claim");
  assert.equal(evaluation.warnings.length, 1);

  const doc = buildDocument(evaluation, COMMON);
  assert.match(doc.text, /労働基準法第37条/);
  assert.match(doc.text, /金800,000円/);
});

test("シナリオ4: クーリングオフ（法定期間内）", () => {
  const evaluation = evaluateScenario("cooling_off", {
    companyName: "株式会社サンプル",
    contractDate: new Date().toISOString().slice(0, 10),
    contractType: "door_to_door",
    productName: "浄水器",
    paidAmount: 300000,
  });
  assert.equal(evaluation.blocked, false);
  assert.equal(evaluation.templateId, "cooling_off_v1");
});

test("シナリオ4: クーリングオフ（法定期間超過はブロック）", () => {
  const evaluation = evaluateScenario("cooling_off", {
    companyName: "株式会社サンプル",
    contractDate: "2026-07-01",
    contractType: "door_to_door",
    productName: "浄水器",
    paidAmount: 300000,
  });
  assert.equal(evaluation.blocked, true);
  assert.equal(evaluation.pattern, "period_expired");
});
