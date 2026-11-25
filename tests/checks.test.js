// 実行: node --test tests/*.test.js
const test = require("node:test");
const assert = require("node:assert");
const C = require("../checks.js");

const allSafe = Object.fromEntries(C.SAFETY_QUESTIONS.map(q => [q.id, q.bad === "yes" ? "no" : "yes"]));

test("安全診断：全部安全なら100点・安心", () => {
  const r = C.scoreSafety(allSafe);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.rank, "安心");
  assert.strictEqual(r.actions.length, 0);
});

test("安全診断：全部危険なら0点", () => {
  const all = Object.fromEntries(C.SAFETY_QUESTIONS.map(q => [q.id, q.bad]));
  const r = C.scoreSafety(all);
  assert.strictEqual(r.score, 0);
  assert.strictEqual(r.actions.length, C.SAFETY_QUESTIONS.length);
});

test("安全診断：フィッシング被害は至急対応", () => {
  const r = C.scoreSafety({ ...allSafe, phishing: "yes" });
  assert.strictEqual(r.urgent, true);
  assert.strictEqual(r.rank, "至急対応");
});

test("安全診断：わからないは半分減点して確認リストへ", () => {
  const r = C.scoreSafety({ ...allSafe, os: "unknown" });
  assert.ok(r.score < 100 && r.score > 90);
  assert.strictEqual(r.checks.length, 1);
});

test("安全診断：対策は重要度順", () => {
  const r = C.scoreSafety({ ...allSafe, wifi: "yes", lock: "no" });
  assert.deepStrictEqual(r.actions.map(q => q.id), ["lock", "wifi"]);
});

test("契約診断：使っていない契約の合計を節約額にする", () => {
  const a = Object.fromEntries(C.CONTRACT_ITEMS.map(i => [i.id, "none"]));
  const r = C.evaluateContract({ ...a, voicemail: "unused", catch: "unused", video: "using", cloud: "unknown" });
  assert.strictEqual(r.saveMin, 550);
  assert.strictEqual(r.saveMax, 550);
  assert.strictEqual(r.using.length, 1);
  assert.strictEqual(r.unknown.length, 1);
});

test("データの必須項目", () => {
  for (const q of C.SAFETY_QUESTIONS) assert.ok(q.id && q.q && q.title && q.iphone && q.android && ["yes", "no"].includes(q.bad), q.id);
  for (const i of C.CONTRACT_ITEMS) assert.ok(i.id && i.name && i.min > 0 && i.max >= i.min, i.id);
});

test("持ち物：キャリアのオプションが「わからない」ならID・暗証番号を強調", () => {
  const a = Object.fromEntries(C.CONTRACT_ITEMS.map(i => [i.id, "none"]));
  const r = C.evaluateContract({ ...a, voicemail: "unknown" });
  const items = C.bringList(r);
  assert.ok(items.find(i => i.name.includes("マイページ")).focus);
  assert.ok(items.find(i => i.name.includes("暗証番号")).focus);
  assert.ok(!items.find(i => i.name.includes("クレジットカード")).focus);
  assert.ok(!items.some(i => i.level === "ifNeeded"));
});

test("持ち物：サブスクが「わからない」ならカード明細を強調、解約候補があれば本人確認書類", () => {
  const a = Object.fromEntries(C.CONTRACT_ITEMS.map(i => [i.id, "none"]));
  const r = C.evaluateContract({ ...a, music: "unknown", catch: "unused" });
  const items = C.bringList(r);
  assert.ok(items.find(i => i.name.includes("クレジットカード")).focus);
  assert.ok(items.some(i => i.level === "ifNeeded" && i.name.includes("本人確認")));
});
