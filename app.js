// 画面まわり（入力の取得・結果の描画・共有・相談メモ）
(function () {
  const $ = id => document.getElementById(id);
  const yen = n => Math.round(n).toLocaleString() + "円";
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const STORAGE_KEY = "planfit:lastInput";
  // 相談会モード（スタッフ用）：?mode=staff で有効。入力を端末に保存せず、URLにも残さない
  const STAFF = new URLSearchParams(location.search).get("mode") === "staff";
  const BASE_QUERY = STAFF ? "?mode=staff" : "";
  // 相談メモ用：各診断の最新結果（1行ずつ）
  const memoState = { plan: null, safety: null, contract: null };
  // 診断書用：各診断の最新結果
  const reportState = { plan: null, safety: null, contract: null };

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
        <div class="checked-at">料金確認日：${esc(p.checkedAt)}（公式サイト）</div>
        <a class="official" href="${esc(p.officialUrl)}" target="_blank" rel="noopener">公式サイトで最新料金を確認 →</a>
      </div>`;
    }).join("");

    const c = r.cheapest;
    const inRanked = r.ranked.some(s => s.plan === c.plan);
    $("cheapestNote").innerHTML = inRanked ? "" :
      `<div class="cheapest-note">💡 重視ポイントを外して<strong>料金だけ</strong>で選ぶと、${esc(c.plan.brand)}「${esc(c.plan.name)}」（約${yen(c.total)}/月）が最安です。</div>`;
  }

  function priceInfo() {
    const checked = typeof APP_VERSION !== "undefined" ? APP_VERSION.priceCheckedAt : "";
    const age = PlanFit.priceAgeDays(checked);
    return { checked, age, stale: age != null && age > PlanFit.PRICE_STALE_DAYS };
  }

  function staleHtml() {
    const info = priceInfo();
    return info.stale
      ? `<div class="stale">⚠️ 料金情報の確認日（${esc(info.checked)}）から ${info.age} 日たっています。料金が変わっている可能性があるので、必ず公式サイトで最新の料金を確認してください。</div>`
      : "";
  }

  function renderConditions(r) {
    const info = priceInfo();
    $("priceConditions").innerHTML = `<h3>📋 この料金の前提</h3><ul>
      <li>料金確認日：<b>${esc(info.checked)}</b>（各社の公式サイトで確認）</li>
      <li>税込・<b>割引前</b>の月額基本料です（家族割・光回線セット割・カード払い割引・キャンペーンは含みません）</li>
      <li>${r.need === "none" ? "通話オプションは含めずに計算しています（通話は従量制）" : "通話は「" + (r.need === "short" ? "短時間かけ放題" : "完全かけ放題") + "」の料金を足して計算しています"}</li>
      <li>端末代の分割払い、通話料（従量）、ユニバーサルサービス料、手数料は含みません</li>
      ${r.currentEstimated ? "<li>今の月額は、ブランドと使い方からの<b>推定</b>です</li>" : ""}
    </ul>${staleHtml()}`;
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
    reportState.plan = { input, r };
    memoState.plan = [
      "・利用中：" + input.carrier + "（月額 約" + yen(r.current) + (r.currentEstimated ? "・推定" : "") + "）",
      "・料金プラン診断のおすすめ：" + r.best.plan.brand + "「" + r.best.plan.name + "」約" + yen(r.best.total) + "/月"
    ];
    updateMemo();
    renderSummary(r);
    renderBars(r);
    renderPlans(r);
    renderConditions(r);

    const url = shareUrl(input);
    if (!STAFF) history.replaceState(null, "", "?" + PlanFit.encodeInput(input) + location.hash);
    const msg = r.alreadyOptimal
      ? "スマホ料金を診断したら、今のプランがすでにお得でした！"
      : `スマホ料金を診断したら、年間 約${yen(r.saving * 12)} 下げられるかも！`;
    $("lineShare").href = "https://line.me/R/share?text=" + encodeURIComponent(msg + "\n" + url);
    $("copyLink").onclick = () => copy(url, "結果のURLをコピーしました");

    if (!STAFF) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(input)); } catch (e) { /* 保存できなくても動作に影響なし */ } }

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

  // ── 診断の選択とタブ切り替え ─────────────────
  // name が null のときは「診断を選ぶ」最初の画面（どのパネルも開かない）
  const TABS = ["plan", "safety", "contract"];
  function showTab(name, { updateHash = true, scroll = false } = {}) {
    const chosen = TABS.includes(name) ? name : null;
    $("tabs").hidden = !chosen;
    document.querySelectorAll(".tab").forEach(t => t.setAttribute("aria-selected", String(t.dataset.tab === chosen)));
    document.querySelectorAll(".choose").forEach(c => c.setAttribute("aria-current", String(c.dataset.tab === chosen)));
    TABS.forEach(n => { $("panel-" + n).hidden = n !== chosen; });
    if (updateHash) {
      const q = chosen === "plan" && !STAFF ? location.search : BASE_QUERY;
      history.replaceState(null, "", (q || location.pathname) + (chosen ? "#" + chosen : ""));
    }
    if (scroll && chosen) $("tabs").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ── ② 安全診断 ─────────────────────────
  function segRadio(name, options, four) {
    return `<div class="seg${four ? " four" : ""}" role="radiogroup">` + options.map(([v, label]) =>
      `<label><input type="radio" name="${name}" value="${v}">${label}</label>`).join("") + "</div>";
  }

  function renderSafetyQuestions() {
    $("safetyQuestions").innerHTML = Checks.SAFETY_QUESTIONS.map((q, i) =>
      `<div class="q" data-id="${q.id}"><div class="q-title">Q${i + 1}. ${esc(q.q)}</div>
        ${segRadio("s_" + q.id, [["yes", "はい"], ["no", "いいえ"], ["unknown", "未確認"]])}</div>`).join("");
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
    reportState.safety = r;
    const color = r.urgent || r.score < 50 ? "#e5484d" : r.rank === "安心" ? "var(--green)" : "var(--orange)";
    const msg = {
      "至急対応": "被害につながるおそれがあります。下の対応を今すぐ行ってください。",
      "要対策": "危ないところがいくつかあります。上から順に直していきましょう。",
      "注意": "おおむね大丈夫ですが、直しておきたいところがあります。",
      "未確認あり": `対策できている項目は多いですが、未確認が ${r.checks.length} 件あります。確認できるまで「安心」とは判定しません。`,
      "安心": "確認したすべての項目で対策できています！この状態をキープしましょう。"
    }[r.rank];
    const stats = `<div class="stat-row">
      <div class="stat ok"><b>${r.okCount}</b>対策済み</div>
      <div class="stat ng"><b>${r.actions.length}</b>要対策</div>
      <div class="stat un"><b>${r.checks.length}</b>未確認</div></div>`;
    const urgent = r.urgent ? `<div class="urgent"><h3>⚠️ 至急やってほしいこと</h3><ol>${Checks.URGENT_STEPS.map(x => `<li>${esc(x)}</li>`).join("")}</ol></div>` : "";
    const actions = r.actions.map((q, i) => `<div class="action"><h3>${i + 1}. ${esc(q.title)}</h3>${howBlock(q)}</div>`).join("");
    const checks = r.checks.map(q => `<div class="action"><h3>確認：${esc(q.title)}</h3>${howBlock(q)}</div>`).join("");
    $("safetyResult").innerHTML = `<div class="step">RESULT</div><h2>安全診断の結果</h2>
      <div class="score-wrap"><div class="score-ring" style="--p:${r.score};--c:${color}"><span>${r.score}</span></div>
        <div><div class="rank-label" style="color:${color}">${r.rank}</div><p class="reason">${msg}</p></div></div>
      ${stats}
      ${urgent}
      ${r.actions.length ? `<h3 class="section-title">やっておきたい対策（${r.actions.length}件）</h3>${actions}` : ""}
      ${r.checks.length ? `<h3 class="section-title">未確認の項目（${r.checks.length}件）：確認のしかた</h3><p class="reason">未確認は「安全」という意味ではありません。下の方法で確認するか、相談会で一緒に確認しましょう。</p>${checks}` : ""}
      ${!r.actions.length && !r.checks.length ? `<p class="reason">対策が必要な項目はありませんでした 🎉</p>` : ""}
      <p class="notice">メニューの名前や場所は、機種やOSのバージョンによって異なることがあります。この診断は情報漏えいや不正利用がないことを保証するものではありません。</p>
      <button type="button" class="ghost print-btn">📄 この結果を診断書として印刷</button>`;
    $("safetyResult").classList.add("show");
    $("safetyResult").scrollIntoView({ behavior: "smooth" });
    memoState.safety = ["・安全診断：" + r.score + "点（" + r.rank + "）",
      ...r.actions.map(q => "　- 要対策：" + q.title), ...r.checks.map(q => "　- 未確認：" + q.title)];
    updateMemo();
  }

  // ── ③ 契約診断 ─────────────────────────
  function renderContractItems() {
    $("contractItems").innerHTML = Checks.CONTRACT_ITEMS.map(item =>
      `<div class="q" data-id="${item.id}"><div class="q-title">${esc(item.name)}<small>目安：月 ${item.min === item.max ? yen(item.min) : yen(item.min) + "〜" + yen(item.max)}</small></div>
        ${segRadio("c_" + item.id, [["none", "入っていない"], ["using", "使っている"], ["unused", "使っていない"], ["unknown", "わからない"]], true)}</div>`).join("");
  }

  const BRING_GROUPS = [["must", "必ず持ってくるもの"], ["recommend", "あれば持ってくるもの"], ["ifNeeded", "その場で手続きまで進める場合"]];

  function renderBringList(r) {
    const items = Checks.bringList(r);
    const focusCount = items.filter(i => i.focus).length;
    const lead = r.unknown.length >= 3
      ? `「わからない」が ${r.unknown.length} 項目ありました。相談会で一緒に確認するのがおすすめです。<strong>★の付いた持ち物</strong>があると、その場で確認できます。`
      : focusCount
        ? `<strong>★の付いた持ち物</strong>があると、「わからない」だった項目をその場で確認できます。`
        : "相談会では、次のものがあるとスムーズに確認・手続きできます。";
    const groups = BRING_GROUPS.map(([level, label]) => {
      const list = items.filter(i => i.level === level);
      if (!list.length) return "";
      return `<h4 class="bring-group">${label}</h4><ul class="bring">${list.map(i =>
        `<li class="${i.focus ? "focus" : ""}"><b>${i.focus ? "★ " : ""}${esc(i.name)}</b><small>${esc(i.why)}</small></li>`).join("")}</ul>`;
    }).join("");
    return `<div class="bring-box">
      <h3>🎒 相談会に持ってくるもの</h3>
      <p class="reason">${lead}</p>
      ${groups}
      <div class="bring-notes">${Checks.BRING_NOTES.map(n => `<p>🔒 ${esc(n)}</p>`).join("")}</div>
      <button type="button" class="ghost" id="copyBring">持ち物リストをコピー（LINE・メモ用）</button>
    </div>`;
  }

  function bringText(r) {
    const items = Checks.bringList(r);
    const lines = ["【スマホ相談会の持ち物】"];
    BRING_GROUPS.forEach(([level, label]) => {
      const list = items.filter(i => i.level === level);
      if (list.length) lines.push("■" + label, ...list.map(i => "・" + (i.focus ? "★" : "") + i.name));
    });
    lines.push("", ...Checks.BRING_NOTES.map(n => "※" + n));
    return lines.join("\n");
  }

  // ── 自由入力の契約 ─────────────────────────
  let customSeq = 0;
  function addCustomRow() {
    const row = document.createElement("div");
    row.className = "custom-row";
    const n = ++customSeq;
    row.innerHTML = `<input type="text" class="c-name" maxlength="40" placeholder="サービス名（例：動画サービス）" aria-label="サービス名 ${n}">
      <input type="number" class="c-fee" min="0" max="100000" step="10" inputmode="numeric" placeholder="月額 円" aria-label="月額 ${n}">
      <select class="c-status" aria-label="状況 ${n}"><option value="unknown">わからない</option><option value="using">使っている</option><option value="unused">使っていない</option></select>
      <button type="button" class="remove" aria-label="この行を削除">×</button>`;
    row.querySelector(".remove").addEventListener("click", () => row.remove());
    $("customContracts").appendChild(row);
    return row;
  }

  function readCustom() {
    return [...document.querySelectorAll("#customContracts .custom-row")].map(row => ({
      name: row.querySelector(".c-name").value,
      fee: row.querySelector(".c-fee").value,
      status: row.querySelector(".c-status").value
    }));
  }

  // ── 診断書（印刷・PDF保存） ─────────────────
  function buildReport() {
    const today = new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });
    const li = arr => arr.length ? `<ul>${arr.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : "<p class='meta'>なし</p>";
    const parts = [`<h1>${STAFF ? "スマホ相談会 診断書" : "スマホ診断書"}</h1><p class="meta">作成日：${today}　／　本人と相談員で内容を確認してください</p>`];
    const P = reportState.plan;
    if (P) {
      const b = P.r.best;
      parts.push(`<div class="box"><h2>① 料金プラン診断</h2><table>
        <tr><th>利用中</th><td>${esc(P.input.carrier)}（月額 約${yen(P.r.current)}${P.r.currentEstimated ? "・推定" : ""}）</td></tr>
        <tr><th>おすすめ</th><td>${esc(b.plan.brand)}「${esc(b.plan.name)}」約${yen(b.total)}/月</td></tr>
        <tr><th>見直し効果</th><td>${P.r.alreadyOptimal ? "今のプランがすでにお得" : `月 約${yen(P.r.saving)}／年 約${yen(P.r.saving * 12)}`}</td></tr>
        <tr><th>ほかの候補</th><td>${P.r.ranked.slice(1).map(x => esc(x.plan.brand + "「" + x.plan.name + "」約" + yen(x.total) + "/月")).join("<br>") || "なし"}</td></tr>
        <tr><th>料金の前提</th><td>料金確認日 ${esc(priceInfo().checked)}／税込・割引前の月額基本料＋必要な通話オプション。割引・キャンペーン・端末代は含みません</td></tr>
      </table></div>`);
    }
    const S = reportState.safety;
    if (S) {
      parts.push(`<div class="box"><h2>② スマホ安全診断　${S.score}点（${esc(S.rank)}）</h2>
        <p class="meta">対策済み ${S.okCount}件／要対策 ${S.actions.length}件／未確認 ${S.checks.length}件（未確認は安全という意味ではありません）</p>
        ${S.urgent ? `<p><b>至急：</b>${Checks.URGENT_STEPS.map(esc).join("／")}</p>` : ""}
        <table><tr><th>要対策</th><td>${li(S.actions.map(q => q.title))}</td></tr>
        <tr><th>未確認</th><td>${li(S.checks.map(q => q.title))}</td></tr></table></div>`);
    }
    const C = reportState.contract;
    if (C) {
      const fee = i => i.min === i.max ? "月 " + yen(i.min) : "月 " + yen(i.min) + "〜" + yen(i.max);
      parts.push(`<div class="box"><h2>③ スマホ契約診断</h2><table>
        <tr><th>解約・見直し候補</th><td>${li(C.unused.map(i => i.name + "（" + fee(i) + (i.custom ? "・実額" : "・目安") + "）"))}${C.unused.length ? `<p class="meta">合計 ${C.saveMin === C.saveMax ? "月 " + yen(C.saveMin) : "月 " + yen(C.saveMin) + "〜" + yen(C.saveMax)}（削減確定額ではありません）</p>` : ""}</td></tr>
        <tr><th>要確認（わからない）</th><td>${li(C.unknown.map(i => i.name))}</td></tr>
        <tr><th>使っている（継続）</th><td>${li(C.using.map(i => i.name))}</td></tr></table></div>`);
      const bring = Checks.bringList(C);
      parts.push(`<div class="box"><h2>相談会の持ち物チェック</h2><ul style="list-style:none;padding-left:0">${bring.map(i =>
        `<li><span class="check"></span>${i.focus ? "★ " : ""}${esc(i.name)}</li>`).join("")}</ul></div>`);
    }
    const picked = [...document.querySelectorAll("#troubleOptions input:checked")].map(x => x.value);
    if (picked.length) parts.push(`<div class="box"><h2>相談したいこと</h2>${li(picked)}</div>`);
    if (!P && !S && !C && !picked.length) parts.push("<p>まだ診断が行われていません。</p>");
    if (STAFF) parts.push(`<div class="box"><h2>相談員記入欄</h2><table>
      <tr><th>相談日・担当</th><td style="height:26px"></td></tr>
      <tr><th>同席</th><td><span class="check"></span>本人のみ　<span class="check"></span>家族　<span class="check"></span>支援者・ケアマネジャー等</td></tr>
      <tr><th>その場で対応したこと</th><td style="height:52px"></td></tr>
      <tr><th>次回までにやること</th><td style="height:52px"></td></tr>
      <tr><th>次回の相談</th><td><span class="check"></span>不要　<span class="check"></span>予定あり（　　月　　日）</td></tr></table></div>`);
    parts.push(`<div class="foot">料金は公式サイト確認時点の参考値で、割引・キャンペーン・端末代・通話料等により実際の負担は変わります。安全診断は情報漏えいや不正利用がないことを保証するものではありません。
      この診断書には氏名・電話番号・パスワードは記載していません。<br>スマホ相談窓口　https://planfit.vercel.app/</div>`);
    $("report").innerHTML = parts.join("");
  }

  function printReport() {
    if (!reportState.plan && !reportState.safety && !reportState.contract) {
      toast("先にいずれかの診断を行ってください");
      return;
    }
    buildReport();
    window.print();
  }

  // ── 全入力を消去（共有端末向け） ─────────────
  function clearAll() {
    const msg = STAFF ? "次の方のために、すべての入力と診断結果を消去しますか？" : "すべての入力と診断結果を消去しますか？\n元に戻すことはできません。";
    if (!window.confirm(msg)) return;
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* 無視 */ }
    document.querySelectorAll("main input[type=radio], main input[type=checkbox]").forEach(x => { x.checked = false; });
    document.querySelector('input[name=carrier][value="ドコモ"]').checked = true;
    $("currentPrice").value = "";
    $("data").value = "30";
    $("call").value = "none";
    syncPriceField();
    $("customContracts").innerHTML = "";
    addCustomRow();
    document.querySelectorAll(".q.missing").forEach(x => x.classList.remove("missing"));
    ["result", "safetyResult", "contractResult"].forEach(id => $(id).classList.remove("show"));
    ["safetyResult", "contractResult", "plans", "summary", "cheapestNote", "priceConditions", "report"].forEach(id => { $(id).innerHTML = ""; });
    Object.keys(memoState).forEach(k => { memoState[k] = null; reportState[k] = null; });
    updateMemo();
    history.replaceState(null, "", BASE_QUERY || location.pathname);
    showTab(null, { updateHash: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast("すべての入力を消去しました");
  }

  function runContract() {
    const { answers, missing } = collect($("contractItems"), "c_", Checks.CONTRACT_ITEMS.map(i => i.id));
    if (missing.length) {
      toast(`未回答が ${missing.length} 項目あります`);
      missing[0].scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const r = Checks.evaluateContract(answers, readCustom());
    reportState.contract = r;
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
      ${renderBringList(r)}
      <p class="notice">金額は一般的な目安です。実際の料金は契約内容によって異なります。解約すると特典や割引がなくなる場合があるので、手続き前に条件を確認してください。</p>
      <button type="button" class="ghost print-btn">📄 この結果を診断書として印刷</button>`;
    $("copyBring").addEventListener("click", () => copy(bringText(r), "持ち物リストをコピーしました"));
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
    document.querySelectorAll(".choose").forEach(c => c.addEventListener("click", () => showTab(c.dataset.tab, { scroll: true })));
    document.addEventListener("click", e => { if (e.target.closest(".print-btn")) printReport(); });
    $("priceStale").innerHTML = staleHtml();
    if (STAFF) {
      document.body.classList.add("staff");
      $("staffBar").hidden = false;
      $("nextPerson").addEventListener("click", clearAll);
      $("bigText").addEventListener("click", () => {
        const on = document.documentElement.classList.toggle("text-lg");
        $("bigText").setAttribute("aria-pressed", String(on));
      });
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* 無視 */ }
    }
    renderSafetyQuestions();
    addCustomRow();
    $("addCustom").addEventListener("click", () => addCustomRow().querySelector(".c-name").focus());
    $("printReport").addEventListener("click", printReport);
    $("clearAll").addEventListener("click", clearAll);
    window.addEventListener("beforeprint", buildReport);
    renderContractItems();
    $("safetyBtn").addEventListener("click", runSafety);
    $("contractBtn").addEventListener("click", runContract);

    // 共有URLから開いたら、その条件で結果を表示。なければ前回の入力を復元
    const fromUrl = STAFF ? null : PlanFit.decodeInput(location.search);
    showTab(fromUrl ? "plan" : location.hash.slice(1), { updateHash: false });
    if (fromUrl) {
      writeInput(fromUrl);
      run(fromUrl, { scroll: true });
    } else if (!STAFF) {
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
