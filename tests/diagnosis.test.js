// 実行: node --test tests/*.test.js
const test = require("node:test");
const assert = require("node:assert");
const { PLANS, TYPICAL_PRICE } = require("../plans.js");
const D = require("../diagnosis.js");

const base = { carrier: "ドコモ", currentPrice: 8000, data: 30, call: "none", prefs: [] };

test("データ量を満たすプランだけをおすすめする", () => {
  const r = D.diagnose(base, PLANS, TYPICAL_PRICE);
  assert.ok(r.ranked.every(s => s.plan.data >= 30));
  assert.strictEqual(r.ranked.length, 3);
});

test("おすすめは1ブランド1枠", () => {
  const r = D.diagnose({ ...base, data: 3 }, PLANS, TYPICAL_PRICE);
  const brands = r.ranked.map(s => s.plan.brand);
  assert.strictEqual(new Set(brands).size, brands.length);
});

test("長電話ならかけ放題オプション代を上乗せする", () => {
  const povo = PLANS.find(p => p.name.includes("povo2.0（30GB"));
  assert.strictEqual(D.monthlyCost(povo, "unlimited").total, povo.price + 1650);
  const ahamo = PLANS.find(p => p.name === "ahamo（40GB）");
  assert.strictEqual(D.monthlyCost(ahamo, "short").total, ahamo.price); // 5分込み
});

test("店舗サポート重視なら店舗のあるプランが1位", () => {
  const r = D.diagnose({ ...base, prefs: ["store"] }, PLANS, TYPICAL_PRICE);
  assert.ok(r.best.plan.store);
});

test("今より安いプランがなければ alreadyOptimal", () => {
  const r = D.diagnose({ ...base, currentPrice: 500, data: 3 }, PLANS, TYPICAL_PRICE);
  assert.strictEqual(r.alreadyOptimal, true);
  assert.strictEqual(r.saving, 0);
});

test("月額わからない場合は推定する", () => {
  const r = D.diagnose({ ...base, currentPrice: null, data: 999 }, PLANS, TYPICAL_PRICE);
  assert.strictEqual(r.currentEstimated, true);
  assert.strictEqual(r.current, TYPICAL_PRICE["ドコモ"].large);
});

test("無制限希望なら無制限プランのみ", () => {
  const r = D.diagnose({ ...base, data: 999 }, PLANS, TYPICAL_PRICE);
  assert.ok(r.ranked.every(s => s.plan.data === 999));
});

test("共有URLのエンコードとデコードが往復する", () => {
  const input = { carrier: "Y!mobile", currentPrice: null, data: 10, call: "short", prefs: ["store", "family"] };
  assert.deepStrictEqual(D.decodeInput("?" + D.encodeInput(input)), input);
});

test("プランデータの必須項目がそろっている", () => {
  for (const p of PLANS) {
    assert.ok(p.brand && p.name && p.officialUrl && p.checkedAt, p.name);
    assert.ok(Number.isFinite(p.price) && p.price > 0, p.name);
    assert.ok(["none", "5min", "10min", "unlimited"].includes(p.callIncluded), p.name);
  }
});
