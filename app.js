// 画面まわり（入力の取得・結果の描画・共有・相談メモ）
(function () {
  const $ = id => document.getElementById(id);
  const yen = n => Math.round(n).toLocaleString() + "円";
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const STORAGE_KEY = "planfit:lastInput";

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
    const memo = $("memo");
    if (!picked.length) {
      memo.classList.remove("show");
      $("ctaNote").textContent = "料金以外の相談も承ります";
      return;
    }
    const input = readInput();
    const r = PlanFit.diagnose(input, PLANS, TYPICAL_PRICE);
    const lines = [
      "【スマホ相談メモ】",
      "・利用中：" + input.carrier + "（月額 約" + yen(r.current) + (r.currentEstimated ? "・推定" : "") + "）",
      "・診断のおすすめ：" + r.best.plan.brand + "「" + r.best.plan.name + "」約" + yen(r.best.total) + "/月",
      "・相談したいこと：",
      ...picked.map(x => "　- " + x)
    ];
    $("memoText").textContent = lines.join("\n");
    memo.classList.add("show");
    $("ctaNote").textContent = `お困りごと ${picked.length} 件を相談メモにまとめました。窓口でそのまま見せられます`;
  }

  function init() {
    $("priceUnknown").addEventListener("change", syncPriceField);
    $("diagnoseBtn").addEventListener("click", () => run(readInput()));
    $("retry").addEventListener("click", () => document.querySelector(".card").scrollIntoView({ behavior: "smooth" }));
    $("troubleOptions").addEventListener("change", updateMemo);
    $("copyMemo").addEventListener("click", () => copy($("memoText").textContent, "相談メモをコピーしました"));

    // 共有URLから開いたら、その条件で結果を表示。なければ前回の入力を復元
    const fromUrl = PlanFit.decodeInput(location.search);
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
