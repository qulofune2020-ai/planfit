import { test } from "node:test";
import assert from "node:assert/strict";
import { toFormParams } from "../src/stripe.js";
import { SCENARIO_PRICES_JPY, SCENARIO_LABELS } from "../src/pricing.js";
import worker from "../src/index.js";

test("toFormParams: ネストしたオブジェクト/配列をStripeの角括弧記法に変換する", () => {
  const params = toFormParams({
    mode: "payment",
    line_items: [{ quantity: 1, price_data: { currency: "jpy", unit_amount: 2980 } }],
    metadata: { scenarioId: "jikou_enyou" },
  });

  assert.ok(params.includes("mode=payment"));
  assert.ok(params.includes("line_items%5B0%5D%5Bquantity%5D=1"));
  assert.ok(params.includes("line_items%5B0%5D%5Bprice_data%5D%5Bcurrency%5D=jpy"));
  assert.ok(params.includes("line_items%5B0%5D%5Bprice_data%5D%5Bunit_amount%5D=2980"));
  assert.ok(params.includes("metadata%5BscenarioId%5D=jikou_enyou"));
});

test("pricing: 4シナリオすべてに料金が設定されている", () => {
  const scenarios = ["jikou_enyou", "furin_isharyou", "zangyou_pawahara", "cooling_off"];
  for (const id of scenarios) {
    assert.ok(SCENARIO_PRICES_JPY[id] > 0, id);
    assert.ok(SCENARIO_LABELS[id], id);
  }
});

const ENV = { ALLOWED_ORIGINS: "http://localhost:3000", STRIPE_SECRET_KEY: "sk_test_dummy" };

test("POST /api/checkout: ブロックされる案件は課金前に弾かれる（Stripeを一切呼ばない）", async () => {
  const request = new Request("http://localhost/api/checkout", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost:3000" },
    body: JSON.stringify({
      scenarioId: "jikou_enyou",
      facts: {
        companyName: "アコム",
        contractNo: "A-1",
        lastTransactionDate: "2024-01-15", // まだ5年経過していない
        debtAmount: 500000,
        hasInterruption: false,
      },
      successUrl: "http://localhost:3000/",
      cancelUrl: "http://localhost:3000/",
    }),
  });

  const response = await worker.fetch(request, ENV);
  assert.equal(response.status, 422);
  const data = await response.json();
  assert.equal(data.error, "blocked_by_rule_engine");
  assert.equal(data.pattern, "not_yet_expired");
});

test("POST /api/checkout: 許可されていないリダイレクト先はオープンリダイレクト対策で拒否する", async () => {
  const request = new Request("http://localhost/api/checkout", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost:3000" },
    body: JSON.stringify({
      scenarioId: "cooling_off",
      facts: {
        companyName: "株式会社サンプル",
        contractDate: new Date().toISOString().slice(0, 10),
        contractType: "door_to_door",
        productName: "浄水器",
        paidAmount: 300000,
      },
      successUrl: "https://evil.example.com/",
      cancelUrl: "http://localhost:3000/",
    }),
  });

  const response = await worker.fetch(request, ENV);
  assert.equal(response.status, 400);
  const data = await response.json();
  assert.equal(data.error, "invalid_redirect_url");
});

test("POST /api/checkout: STRIPE_SECRET_KEY未設定なら明示的にエラーを返す", async () => {
  const request = new Request("http://localhost/api/checkout", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost:3000" },
    body: JSON.stringify({
      scenarioId: "cooling_off",
      facts: {},
      successUrl: "http://localhost:3000/",
      cancelUrl: "http://localhost:3000/",
    }),
  });

  const response = await worker.fetch(request, { ALLOWED_ORIGINS: "http://localhost:3000" });
  assert.equal(response.status, 500);
  const data = await response.json();
  assert.equal(data.error, "stripe_not_configured");
});

test("GET /api/pricing: シナリオ別料金を返す", async () => {
  const request = new Request("http://localhost/api/pricing");
  const response = await worker.fetch(request, ENV);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.prices.jikou_enyou, 1980);
  assert.equal(data.prices.furin_isharyou, 1980);
});
