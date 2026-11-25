// 画面まわり（入力の取得・結果の描画・共有・相談メモ）
(function () {
  const $ = id => document.getElementById(id);
  const yen = n => Math.round(n).toLocaleString() + "円";
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const STORAGE_KEY = "planfit:lastInput";
  // 相談メモ用：各診断の最新結果（1行ずつ）
  const memoState = { plan: null, safety: null, contract: null };

  function readInput() {
    const carrier = (document.querySelector("input[name=carrier]:checked") || {}).value || "その他";
    const unknown = $("priceUnknown").checked;
    const raw = $("currentPrice").value;
    return {
      carrier,
      currentPrice: unknown || raw === "" ? null : Math.max(0, Number(raw) || 0),
      data: Number($("data").value),
      call: $("call").value,
      prefs: [...document.querySelectorAll("#preferenceOptions input:checked")].map(x => x.value)
    };
  }

  function writeInput(input) {
    const radio = [...document.querySelectorAll("input[name=carrier]")].find(r => r.value === input.carrier);
    if (radio) radio.checked = true;
    $("priceUnknown").checked = input.currentPrice == null;
    if (input.currentPrice != null) $("currentPrice").value = input.currentPrice;
    syncPriceField();
    if ([...$("data").options].some(o => Number(o.value) === input.data)) $("data").value = String(input.data);
    if ([...$("call").options].some(o => o.value === input.call)) $("call").value = input.call;
    document.querySelectorAll("#preferenceOptions input").forEach(cb => { cb.checked = input.prefs.includes(cb.value); });
  }

  function syncPriceField() {
    $("currentPrice").disabled = $("priceUnknown").checked;
  }

  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove("show"), 1800);
  }

  async function copy(text, okMsg) {
    try {
      await navigator.clipboard.writeText(text);
      toast(okMsg);
    } catch (e) {
      window.prompt("コピーしてください", text);
    }
  }

  function renderSummary(r) {
    const est = r.currentEstimated
      ? `<div class="estimate-note">※ 現在の月額は「${esc(readInput().carrier)}」の一般的な料金から推定しています（約${yen(r.current)}）</div>`
      : "";
    if (r.alreadyOptimal) {
      $("summary").innerHTML = `<div class="optimal">今のプランは、すでにかなりお得です 🎉
        <small>条件に合うプランの中で、今より安くなるものは見つかりませんでした。無理に乗り換える必要はなさそうです。</small></div>${est}`;
      return;
    }
    $("summary").innerHTML = `<div class="summary">
        <div class="small">現在の料金から</div>
        <div class="big">月額 約${yen(r.saving)}</div>
        <div class="year">年間 約${yen(r.saving * 12)}</div>
        <div class="small">下げられる可能性があります</div>
        <div class="five">5年間で 約${yen(r.saving * 60)} の差</div>
      </div>${est}`;
  }

  function renderPlans(r) {
    $("plans").innerHTML = r.ranked.map((s, i) => {
      const p = s.plan;
      const chips = [
        s.sameBrand ? '<span class="chip same">乗り換え不要</span>' : "",
        s.saving > 0 ? `<span class="chip save">月 ${yen(s.saving)} おトク</span>` : ""
      ].join("");
      const tags = [
        p.store ? "店舗対応" : "オンライン専用",
        p.family ? "家族向け" : "",
        p.senior ? "シニア向け" : "",
        p.data === 999 ? "データ無制限" : p.data + "GB"
      ].filter(Boolean).map(t => `<span class="tag">${t}</span>`).join("");
      const cautions = s.cautions.length
        ? `<ul class="caution-list">${s.cautions.map(c => `<li>${esc(c)}</li>`).join("")}</ul>` : "";
      return `<div class="plan ${i === 0 ? "best" : ""}">
        <div class="rank">${i === 0 ? "おすすめ1位" : "おすすめ" + (i + 1) + "位"}</div>
        <div class="plan-head">
          <div><h3>${esc(p.brand)}</h3><div>${esc(p.name)}</div><div class="plan-meta">${chips}</div></div>
          <div class="price">約${yen(s.total)}/月</div>
        </div>
        <ul class="reason-list">${s.reasons.map(x => `<li>${esc(x)}</li>`).join("")}</ul>
        ${cautions}
        <div class="tags">${tags}</div>
        <a class="official" href="${esc(p.officialUrl)}" target="_blank" rel="noopener">公式サイトで最新料金を確認 →</a>
      </div>`;
    }).join("");

    const c = r.cheapest;
    const inRanked = r.ranked.some(s => s.plan === c.plan);
    $("cheapestNote").innerHTML = inRanked ? "" :
      `<div class="cheapest-note">💡 重視ポイントを外して<strong>料金だけ</strong>で選ぶと、${esc(c.plan.brand)}「${esc(c.plan.name)}」（約${yen(c.total)}/月）が最安です。</div>`;
  }

  function renderBars(r) {
    const rec = r.best.total;
    const max = Math.max(r.current, rec, 1);
    $("barNow").style.width = (r.current / max * 100) + "%";
    $("barRec").style.width = (rec / max * 100) + "%";
    $("currentMonthly").textContent = $("currentMonthlyT").textContent = yen(r.current);
    $("recommendedMonthly").textContent = $("recommendedMonthlyT").textContent = yen(rec);
    $("currentAnnual").textContent = yen(r.current * 12);
    $("recommendedAnnual").textContent = yen(rec * 12);
  }

  function shareUrl(input) {
    return location.origin + location.pathname + "?" + PlanFit.encodeInput(input);
  }

  function run(input, { scroll = true } = {}) {
    const r = PlanFit.diagnose(input, PLANS, TYPICAL_PRICE);
    memoState.plan = [
      "・利用中：" + input.carrier + "（月額 約" + yen(r.current) + (r.currentEstimated ? "・推定" : "") + "）",
      "・料金プラン診断のおすすめ：" + r.best.plan.brand + "「" + r.best.plan.name + "」約" + yen(r.best.total) + "/月"
    ];
    updateMemo();
    renderSummary(r);
    renderBars(r);
    renderPlans(r);

    const url = shareUrl(input);
    history.replaceState(null, "", "?" + PlanFit.encodeInput(input));
    const msg = r.alreadyOptimal
      ? "スマホ料金を診断したら、今のプランがすでにお得でした！"
      : `スマホ料金を診断したら、年間 約${yen(r.saving * 12)} 下げられるかも！`;
    $("lineShare").href = "https://line.me/R/share?text=" + encodeURIComponent(msg + "\n" + url);
    $("copyLink").onclick = () => copy(url, "結果のURLをコピーしました");

    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(input)); } catch (e) { /* 保存できなくても動作に影響なし */ }

    $("result").classList.add("show");
    if (scroll) $("result").scrollIntoView({ behavior: "smooth" });
  }

  function updateMemo() {
    const picked = [...document.querySelectorAll("#troubleOptions input:checked")].map(x => x.value);
    const results = [memoState.plan, memoState.safety, memoState.contract].filter(Boolean).flat();
    const memo = $("memo");
    if (!picked.length && !results.length) {
      memo.classList.remove("show");
      $("ctaNote").textContent = "料金以外の相談も承ります";
      return;
    }
    const lines = ["【スマホ相談メモ】", ...results];
    if (picked.length) lines.push("・相談したいこと：", ...picked.map(x => "　- " + x));
    $("memoText").textContent = lines.join("\n");
    memo.classList.add("show");
    $("ctaNote").textContent = "診断結果とお困りごとを相談メモにまとめました。窓口でそのまま見せられます";
  }

  // ── タブ切り替え ─────────────────────────
  const TABS = ["plan", "safety", "contract"];
  function showTab(name, { updateHash = true } = {}) {
    if (!TABS.includes(name)) name = "plan";
    document.querySelectorAll(".tab").forEach(t => t.setAttribute("aria-selected", String(t.dataset.tab === name)));
    TABS.forEach(n => { $("panel-" + n).hidden = n !== name; });
    if (updateHash) history.replaceState(null, "", (name === "plan" ? location.search : location.pathname) + "#" + name);
  }

  // ── ② 安全診断 ─────────────────────────
  function segRadio(name, options, four) {
    return `<div class="seg${four ? " four" : ""}" role="radiogroup">` + options.map(([v, label]) =>
      `<label><input type="radio" name="${name}" value="${v}">${label}</label>`).join("") + "</div>";
  }

  function renderSafetyQuestions() {
    $("safetyQuestions").innerHTML = Checks.SAFETY_QUESTIONS.map((q, i) =>
      `<div class="q" data-id="${q.id}"><div class="q-title">Q${i + 1}. ${esc(q.q)}</div>
        ${segRadio("s_" + q.id, [["yes", "はい"], ["no", "いいえ"], ["unknown", "わからない"]])}</div>`).join("");
  }

  function collect(container, prefix, ids) {
    const answers = {};
    const missing = [];
    ids.forEach(id => {
      const el = document.querySelector(`input[name="${prefix}${id}"]:checked`);
      const row = container.querySelector(`[data-id="${id}"]`);
      if (el) { answers[id] = el.value; row.classList.remove("missing"); }
      else { missing.push(row); row.classList.add("missing"); }
    });
    return { answers, missing };
  }

  function howBlock(q) {
    return `<div class="how"><b>iPhone：</b>${esc(q.iphone)}<br><b>Android：</b>${esc(q.android)}</div>`;
  }

  function runSafety() {
    const { answers, missing } = collect($("safetyQuestions"), "s_", Checks.SAFETY_QUESTIONS.map(q => q.id));
    if (missing.length) {
      toast(`未回答が ${missing.length} 問あります`);
      missing[0].scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const r = Checks.scoreSafety(answers);
    const color = r.urgent || r.score < 50 ? "#e5484d" : r.score < 80 ? "var(--orange)" : "var(--green)";
    const msg = {
      "至急対応": "被害につながるおそれがあります。下の対応を今すぐ行ってください。",
      "要対策": "危ないところがいくつかあります。上から順に直していきましょう。",
      "注意": "おおむね大丈夫ですが、直しておきたいところがあります。",
      "安心": "しっかり対策できています！この状態をキープしましょう。"
    }[r.rank];
    const urgent = r.urgent ? `<div class="urgent"><h3>⚠️ 至急やってほしいこと</h3><ol>${Checks.URGENT_STEPS.map(x => `<li>${esc(x)}</li>`).join("")}</ol></div>` : "";
    const actions = r.actions.map((q, i) => `<div class="action"><h3>${i + 1}. ${esc(q.title)}</h3>${howBlock(q)}</div>`).join("");
    const checks = r.checks.map(q => `<div class="action"><h3>確認：${esc(q.title)}</h3>${howBlock(q)}</div>`).join("");
    $("safetyResult").innerHTML = `<div class="step">RESULT</div><h2>安全診断の結果</h2>
      <div class="score-wrap"><div class="score-ring" style="--p:${r.score};--c:${color}"><span>${r.score}</span></div>
        <div><div class="rank-label" style="color:${color}">${r.rank}</div><p class="reason">${msg}</p></div></div>
      ${urgent}
      ${r.actions.length ? `<h3 class="section-title">やっておきたい対策（${r.actions.length}件）</h3>${actions}` : ""}
      ${r.checks.length ? `<h3 class="section-title">「わからない」だった項目の確認方法</h3>${checks}` : ""}
      ${!r.actions.length && !r.checks.length ? `<p class="reason">対策が必要な項目はありませんでした 🎉</p>` : ""}
      <p class="notice">メニューの名前や場所は、機種やOSのバージョンによって異なることがあります。設定が難しい場合は、下のスマホ相談窓口で一緒に確認できます。</p>`;
    $("safetyResult").classList.add("show");
    $("safetyResult").scrollIntoView({ behavior: "smooth" });
    memoState.safety = ["・安全診断：" + r.score + "点（" + r.rank + "）",
      ...r.actions.map(q => "　- 要対策：" + q.title), ...r.checks.map(q => "　- 要確認：" + q.title)];
    updateMemo();
  }

  // ── ③ 契約診断 ─────────────────────────
  function renderContractItems() {
    $("contractItems").innerHTML = Checks.CONTRACT_ITEMS.map(item =>
      `<div class="q" data-id="${item.id}"><div class="q-title">${esc(item.name)}<small>目安：月 ${item.min === item.max ? yen(item.min) : yen(item.min) + "〜" + yen(item.max)}</small></div>
        ${segRadio("c_" + item.id, [["none", "入っていない"], ["using", "使っている"], ["unused", "使っていない"], ["unknown", "わからない"]], true)}</div>`).join("");
  }

  function runContract() {
    const { answers, missing } = collect($("contractItems"), "c_", Checks.CONTRACT_ITEMS.map(i => i.id));
    if (missing.length) {
      toast(`未回答が ${missing.length} 項目あります`);
      missing[0].scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const r = Checks.evaluateContract(answers);
    const range = (a, b) => a === b ? "約" + yen(a) : "約" + yen(a) + "〜" + yen(b);
    const summary = r.unused.length
      ? `<div class="summary"><div class="small">使っていない契約を見直すと</div>
          <div class="big wrap">月 ${range(r.saveMin, r.saveMax)}</div>
          <div class="year">年間 ${range(r.saveMin * 12, r.saveMax * 12)}</div>
          <div class="small">節約できる可能性があります</div></div>`
      : `<div class="optimal">使っていない契約は見つかりませんでした 👍<small>${r.unknown.length ? "「わからない」項目だけ、下の方法で確認しておきましょう。" : "ムダのない契約です。"}</small></div>`;
    const unused = r.unused.map(i => `<div class="action"><h3>✂️ ${esc(i.name)}（月 ${range(i.min, i.max)}）</h3><p class="reason">${esc(i.hint)}</p></div>`).join("");
    const unknown = r.unknown.length ? `<h3 class="section-title">「わからない」の確認方法</h3>
      <ul class="ok-list">${r.unknown.map(i => `<li>${esc(i.name)}</li>`).join("")}</ul>
      <div class="how">${Checks.CONTRACT_HOWTO.map(esc).join("<br>")}</div>` : "";
    $("contractResult").innerHTML = `<div class="step">RESULT</div><h2>契約診断の結果</h2>${summary}
      ${r.unused.length ? `<h3 class="section-title">解約・見直し候補（${r.unused.length}件）</h3>${unused}<div class="how"><b>解約の方法：</b>キャリアのオプションは会員ページ・アプリ・店舗で、サブスクは契約したアプリやサイトの設定から手続きできます。${r.unknown.length ? "" : "<br>" + Checks.CONTRACT_HOWTO.slice(0, 3).map(esc).join("<br>")}</div>` : ""}
      ${unknown}
      ${r.using.length ? `<h3 class="section-title">使っている契約（そのままでOK）</h3><ul class="ok-list">${r.using.map(i => `<li>${esc(i.name)}</li>`).join("")}</ul>` : ""}
      <p class="notice">金額は一般的な目安です。実際の料金は契約内容によって異なります。解約すると特典や割引がなくなる場合があるので、手続き前に条件を確認してください。</p>`;
    $("contractResult").classList.add("show");
    $("contractResult").scrollIntoView({ behavior: "smooth" });
    memoState.contract = ["・契約診断：見直し候補 " + r.unused.length + "件" + (r.unused.length ? "（月 " + range(r.saveMin, r.saveMax) + "）" : ""),
      ...r.unused.map(i => "　- 解約候補：" + i.name), ...r.unknown.map(i => "　- 要確認：" + i.name)];
    updateMemo();
  }

  function init() {
    $("priceUnknown").addEventListener("change", syncPriceField);
    $("diagnoseBtn").addEventListener("click", () => run(readInput()));
    $("retry").addEventListener("click", () => document.querySelector(".card").scrollIntoView({ behavior: "smooth" }));
    $("troubleOptions").addEventListener("change", updateMemo);
    $("copyMemo").addEventListener("click", () => copy($("memoText").textContent, "相談メモをコピーしました"));
    document.querySelectorAll(".tab").forEach(t => t.addEventListener("click", () => showTab(t.dataset.tab)));
    renderSafetyQuestions();
    renderContractItems();
    $("safetyBtn").addEventListener("click", runSafety);
    $("contractBtn").addEventListener("click", runContract);

    // 共有URLから開いたら、その条件で結果を表示。なければ前回の入力を復元
    const fromUrl = PlanFit.decodeInput(location.search);
    showTab(fromUrl ? "plan" : location.hash.slice(1), { updateHash: false });
    if (fromUrl) {
      writeInput(fromUrl);
      run(fromUrl, { scroll: true });
    } else {
      try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
        if (saved) writeInput(saved);
      } catch (e) { /* 無視 */ }
    }

    if (typeof APP_VERSION !== "undefined") {
      $("versionInfo").textContent = "Version " + APP_VERSION.version + "｜料金情報確認日：" + APP_VERSION.priceCheckedAt;
    }
  }

  init();
})();
