// 診断ロジック（DOM に依存しない純粋関数。ブラウザと Node のテストで共用）
(function (root) {
  const CALL_LABEL = {
    none: "通話オプションなし",
    short: "短時間かけ放題",
    unlimited: "完全かけ放題"
  };

  // 通話の使い方と重視ポイントから、必要な通話オプションを決める
  function callNeed(call, prefs) {
    if (call === "many" || prefs.includes("unlimited")) return "unlimited";
    if (call === "short") return "short";
    return "none";
  }

  // プランの実質月額（基本料＋必要な通話オプション）
  function monthlyCost(plan, need) {
    if (need === "none") return { total: plan.price, addon: 0, callNote: "" };
    const inc = plan.callIncluded;
    if (inc === "unlimited" || (need === "short" && (inc === "5min" || inc === "10min"))) {
      const label = inc === "unlimited" ? "かけ放題" : inc === "5min" ? "5分かけ放題" : "10分かけ放題";
      return { total: plan.price, addon: 0, callNote: label + "が料金に込み" };
    }
    const addon = plan.callOptions ? plan.callOptions[need] : null;
    if (addon == null) return { total: plan.price, addon: 0, callNote: CALL_LABEL[need] + "は提供なし" };
    return {
      total: plan.price + addon,
      addon,
      callNote: CALL_LABEL[need] + "オプション（+" + addon.toLocaleString() + "円）込みで計算"
    };
  }

  // 「今の月額がわからない」ときの推定値
  function estimateCurrentPrice(carrier, data, call, typical) {
    const t = typical[carrier] || typical["その他"];
    const base = data <= 10 ? t.small : t.large;
    const callAdd = call === "many" ? 1980 : call === "short" ? 880 : 0;
    return base + callAdd;
  }

  function buildReasons(plan, cost, input, sameBrand) {
    const reasons = [];
    const prefs = input.prefs;
    if (sameBrand) reasons.push("今のブランドのままプラン変更でOK（乗り換え不要）");
    if (plan.data === 999) reasons.push("データ無制限で容量を気にせず使える");
    else if (input.data >= 999) reasons.push("無制限ではないが " + plan.data + "GB まで使える");
    else reasons.push("毎月 " + input.data + "GB 程度の使い方に対して " + plan.data + "GB あり");
    if (cost.callNote) reasons.push(cost.callNote);
    if (prefs.includes("store") && plan.store) reasons.push("店舗で対面相談できる");
    if (prefs.includes("family") && plan.family) reasons.push("家族割の対象");
    if (prefs.includes("senior") && plan.senior) reasons.push("シニア向けの割引・サポートあり");
    if (!plan.store) reasons.push("オンライン専用なので料金が抑えめ");
    if (plan.family) reasons.push("家族割・光回線セット割でさらに安くなる場合あり");
    return reasons;
  }

  function buildCautions(plan, input) {
    const c = [];
    if (input.prefs.includes("store") && !plan.store) c.push("店舗サポートなし（手続きはオンライン）");
    if (input.prefs.includes("family") && !plan.family) c.push("家族割はなし");
    if (input.data >= 999 && plan.data !== 999) c.push("データ無制限ではありません");
    return c;
  }

  // input: { carrier, currentPrice (null = わからない), data, call, prefs[] }
  function diagnose(input, plans, typical) {
    const prefs = input.prefs || [];
    const need = callNeed(input.call, prefs);
    const currentEstimated = input.currentPrice == null;
    const current = currentEstimated
      ? estimateCurrentPrice(input.carrier, input.data, input.call, typical)
      : input.currentPrice;

    let candidates = plans.filter(p => p.data >= input.data);
    if (!candidates.length) {
      const maxData = Math.max(...plans.map(p => p.data));
      candidates = plans.filter(p => p.data === maxData);
    }

    const priceWeight = prefs.includes("cheap") ? 1.5 : 1;
    const scored = candidates.map(plan => {
      const cost = monthlyCost(plan, need);
      const sameBrand = plan.brand === input.carrier;
      let score = -cost.total * priceWeight;
      if (prefs.includes("store")) score += plan.store ? 2500 : -3000;
      if (prefs.includes("family") && plan.family) score += 1500;
      if (prefs.includes("senior") && plan.senior) score += 2000;
      if (sameBrand) score += 300; // 手間が少ない分ちょっとだけ優遇
      return {
        plan,
        total: cost.total,
        addon: cost.addon,
        saving: Math.max(0, current - cost.total),
        diff: current - cost.total,
        sameBrand,
        score,
        reasons: buildReasons(plan, cost, { ...input, prefs }, sameBrand),
        cautions: buildCautions(plan, { ...input, prefs })
      };
    }).sort((a, b) => b.score - a.score);

    // 1ブランド1枠にして、上位3つを多様に
    const seen = new Set();
    const ranked = [];
    for (const s of scored) {
      if (seen.has(s.plan.brand)) continue;
      seen.add(s.plan.brand);
      ranked.push(s);
      if (ranked.length === 3) break;
    }

    // 最安プラン（重視ポイント抜きで、単純に一番安いもの）
    const cheapest = scored.reduce((a, b) => (b.total < a.total ? b : a), scored[0]);

    const best = ranked[0];
    return {
      current,
      currentEstimated,
      need,
      ranked,
      best,
      cheapest,
      saving: best.saving,
      alreadyOptimal: best.diff <= 0
    };
  }

  // 共有URL用の入力のエンコード／デコード
  function encodeInput(input) {
    const q = new URLSearchParams();
    q.set("c", input.carrier);
    if (input.currentPrice != null) q.set("p", String(input.currentPrice));
    q.set("d", String(input.data));
    q.set("k", input.call);
    if (input.prefs.length) q.set("f", input.prefs.join(","));
    return q.toString();
  }

  function decodeInput(search) {
    const q = new URLSearchParams(search);
    if (!q.has("c") || !q.has("d")) return null;
    const p = q.get("p");
    return {
      carrier: q.get("c"),
      currentPrice: p === null || p === "" ? null : Number(p),
      data: Number(q.get("d")),
      call: q.get("k") || "none",
      prefs: q.get("f") ? q.get("f").split(",") : []
    };
  }

  const api = { diagnose, monthlyCost, callNeed, estimateCurrentPrice, encodeInput, decodeInput };
  if (typeof module !== "undefined") module.exports = api;
  else root.PlanFit = api;
})(this);
