// ② スマホ安全診断 ／ ③ スマホ契約診断 のデータと判定ロジック（DOM非依存）
(function (root) {
  // ── ② 安全診断 ─────────────────────────────
  // bad    : 危険側の回答（"yes" or "no"）
  // weight : 重み（大きいほど重要）
  // urgent : 危険側なら「至急対応」を表示
  const SAFETY_QUESTIONS = [
    {
      id: "os", q: "OS（iOS／Android）を最新に更新していますか？", bad: "no", weight: 3,
      title: "OSを最新にして、自動アップデートをオンに",
      iphone: "設定 → 一般 → ソフトウェアアップデート → 自動アップデートをオン",
      android: "設定 → システム → システムアップデート（機種により名称が異なります）"
    },
    {
      id: "lock", q: "画面ロック（パスコード・指紋・顔認証）を設定していますか？", bad: "no", weight: 3,
      title: "画面ロックを設定する",
      iphone: "設定 → Face ID（Touch ID）とパスコード → パスコードをオンにする",
      android: "設定 → セキュリティ → 画面ロック"
    },
    {
      id: "store", q: "公式ストア（App Store／Google Play）以外からアプリを入れたことがありますか？", bad: "yes", weight: 3,
      title: "公式ストア以外のアプリを削除し、提供元不明アプリの許可をオフに",
      iphone: "身に覚えのない「構成プロファイル」がないか確認：設定 → 一般 → VPNとデバイス管理",
      android: "設定 → アプリ で一覧を確認して削除。設定 → セキュリティ →「不明なアプリのインストール」を許可しない"
    },
    {
      id: "unknownApp", q: "見覚えのないアプリや、長い間使っていないアプリがありますか？", bad: "yes", weight: 2,
      title: "使っていないアプリを整理する",
      iphone: "設定 → 一般 → iPhoneストレージ で最終使用日を確認して削除",
      android: "Playストア → プロフィールアイコン → アプリとデバイスの管理 → 管理 で使用状況を確認して削除"
    },
    {
      id: "perm", q: "アプリの権限（位置情報・連絡先・カメラ・マイク）を見直したことがありますか？", bad: "no", weight: 2,
      title: "アプリの権限を見直す",
      iphone: "設定 → プライバシーとセキュリティ → 位置情報サービス・連絡先・カメラ などを確認",
      android: "設定 → セキュリティとプライバシー → 権限マネージャー（機種により名称が異なります）"
    },
    {
      id: "phishing", q: "SMSやメールのリンクから、ID・パスワードやカード番号を入力したことがありますか？", bad: "yes", weight: 4, urgent: true,
      title: "入力したサービスのパスワードを変更し、カード会社に連絡",
      iphone: "SMSの不審なリンクは開かない。設定 → メッセージ →「不明な差出人をフィルタ」をオン",
      android: "メッセージアプリの設定で「迷惑メッセージ対策」をオン（機種により名称が異なります）"
    },
    {
      id: "fakeWarn", q: "「ウイルスに感染しました」などの警告を見て、電話をかけたりアプリを入れたりしたことがありますか？", bad: "yes", weight: 4, urgent: true,
      title: "入れたアプリ（遠隔操作アプリなど）を削除し、パスワードを変更",
      iphone: "偽の警告はブラウザを閉じれば消えます。設定 → Safari → 履歴とWebサイトデータを消去",
      android: "偽の警告はブラウザを閉じれば消えます。Chrome → 設定 → サイトの設定 → 通知 で不審なサイトをブロック"
    },
    {
      id: "reuse", q: "同じパスワードを複数のサービスで使い回していますか？", bad: "yes", weight: 3,
      title: "大事なサービスからパスワードを別々にする",
      iphone: "設定 → パスワード（パスワードアプリ）で「セキュリティに関する勧告」を確認",
      android: "Googleパスワードマネージャー → パスワードチェックアップ で使い回しを確認"
    },
    {
      id: "twofa", q: "Apple ID／Googleアカウントで2段階認証を設定していますか？", bad: "no", weight: 3,
      title: "2段階認証を設定する",
      iphone: "設定 → 自分の名前 → サインインとセキュリティ → 2ファクタ認証",
      android: "Googleアカウント → セキュリティ → 2段階認証プロセス"
    },
    {
      id: "wifi", q: "カフェや駅などの無料Wi-Fiで、ログインや買い物をしますか？", bad: "yes", weight: 1,
      title: "無料Wi-Fiでは大事なログインや買い物を避ける",
      iphone: "ログインや支払いはモバイル回線（Wi-Fiオフ）で行う",
      android: "ログインや支払いはモバイル回線（Wi-Fiオフ）で行う"
    },
    {
      id: "backup", q: "写真や連絡先のバックアップを取っていますか？", bad: "no", weight: 2,
      title: "バックアップをオンにする",
      iphone: "設定 → 自分の名前 → iCloud → iCloudバックアップ をオン",
      android: "設定 → Google → バックアップ（写真は Googleフォト のバックアップをオン）"
    },
    {
      id: "find", q: "紛失時に探せる機能（iPhoneを探す／デバイスを探す）はオンですか？", bad: "no", weight: 2,
      title: "紛失時に探せる機能をオンにする",
      iphone: "設定 → 自分の名前 → 探す → iPhoneを探す をオン",
      android: "設定 → Google → 「デバイスを探す」をオン（機種により場所が異なります）"
    }
  ];

  const URGENT_STEPS = [
    "入力したサービスのパスワードをすぐ変更（同じパスワードを使っている他のサービスも）",
    "カード番号を入力した場合は、カード会社に連絡して利用停止・再発行",
    "指示されて入れたアプリ（遠隔操作アプリなど）を削除",
    "困ったら：消費者ホットライン「188」、警察相談専用電話「#9110」"
  ];

  // answers: { [id]: "yes" | "no" | "unknown" }
  function scoreSafety(answers) {
    let total = 0, lost = 0;
    const actions = [], checks = [];
    let urgent = false;
    for (const q of SAFETY_QUESTIONS) {
      total += q.weight;
      const a = answers[q.id];
      if (a === q.bad) {
        lost += q.weight;
        actions.push(q);
        if (q.urgent) urgent = true;
      } else if (a === "unknown") {
        lost += q.weight / 2;
        checks.push(q);
      }
    }
    actions.sort((a, b) => b.weight - a.weight);
    const score = Math.round(100 * (1 - lost / total));
    const rank = urgent ? "至急対応" : score >= 80 ? "安心" : score >= 50 ? "注意" : "要対策";
    return { score, rank, urgent, actions, checks, answered: Object.keys(answers).length };
  }

  // ── ③ 契約診断 ─────────────────────────────
  // min / max : 月額の目安（円）
  const CONTRACT_ITEMS = [
    { id: "voicemail", name: "留守番電話（有料）", min: 330, max: 330, hint: "プランによっては無料で付いています" },
    { id: "catch", name: "割込通話（キャッチホン）", min: 220, max: 220, hint: "ほとんど使わない人が多いオプションです" },
    { id: "insurance", name: "端末の補償サービス（故障・紛失）", min: 500, max: 1500, hint: "古い機種や分割払いが終わった機種は見直し余地あり" },
    { id: "security", name: "キャリアのセキュリティ・迷惑電話対策", min: 220, max: 550, hint: "スマホ標準の機能で代わりになる場合があります" },
    { id: "video", name: "動画配信（Netflix・Amazonプライム・Disney+ など）", min: 600, max: 2000, hint: "家族で重複して契約していないか確認" },
    { id: "music", name: "音楽配信（Spotify・Apple Music・YouTube Premium など）", min: 980, max: 1500, hint: "無料体験から自動で有料になっていないか確認" },
    { id: "subscription", name: "月額プラン（サブスク）", min: 400, max: 1000, hint: "雑誌・マンガ・アプリなど、動画・音楽以外の月額サービス。契約時に一緒に入って、そのままのことが多いです" },
    { id: "cloud", name: "クラウド容量（iCloud+・Google One など）", min: 130, max: 1500, hint: "容量を使い切っていなければ下のプランに変更できます" },
    { id: "trial", name: "「最初の◯カ月無料」で入ったオプション", min: 300, max: 1000, hint: "無料期間が終わって課金が始まっていることがあります" },
    { id: "extraLine", name: "使っていない回線（タブレット・Wi-Fiルーター・古いスマホ）", min: 500, max: 3000, hint: "回線ごとに基本料がかかり続けます" }
  ];

  const CONTRACT_HOWTO = [
    "キャリアの契約内容：My docomo／My au／My SoftBank などの会員ページ・アプリの「契約内容の確認」",
    "iPhoneのサブスク：設定 → 自分の名前 → サブスクリプション",
    "Androidのサブスク：Playストア → プロフィールアイコン → お支払いと定期購入 → 定期購入",
    "クレジットカード・キャリア決済の利用明細で、毎月引き落とされているものを確認"
  ];

  // answers: { [id]: "none" | "using" | "unused" | "unknown" }
  // custom : 自由入力の契約 [{ name, fee, status: "using" | "unused" | "unknown" }]
  //          金額は実額なので、節約額の幅には同じ値（min = max）で加える
  function evaluateContract(answers, custom = []) {
    const unused = [], unknown = [], using = [];
    for (const item of CONTRACT_ITEMS) {
      const a = answers[item.id];
      if (a === "unused") unused.push(item);
      else if (a === "unknown") unknown.push(item);
      else if (a === "using") using.push(item);
    }
    custom.forEach((c, i) => {
      const name = String(c.name || "").trim();
      const fee = Math.max(0, Math.round(Number(c.fee) || 0));
      if (!name && !fee) return;
      const item = { id: "custom" + i, name: name || "名称未入力の契約", min: fee, max: fee, custom: true,
        hint: fee ? "入力された月額です" : "月額は未入力です" };
      if (c.status === "unused") unused.push(item);
      else if (c.status === "using") using.push(item);
      else unknown.push(item);
    });
    const saveMin = unused.reduce((s, i) => s + i.min, 0);
    const saveMax = unused.reduce((s, i) => s + i.max, 0);
    return { unused, unknown, using, saveMin, saveMax };
  }

  // ── 相談会の持ち物 ─────────────────────────
  // キャリア側で確認する項目／ストア・カード側で確認する項目
  const CARRIER_ITEM_IDS = ["voicemail", "catch", "insurance", "security", "trial", "extraLine"];
  const SUBS_ITEM_IDS = ["video", "music", "subscription", "cloud"];

  const BRING_NOTES = [
    "パスワードはご自身で入力していただきます。スタッフがお聞きしたり、メモしたりすることはありません。",
    "ID・パスワードがわからない方もご相談ください。再設定のお手伝いをします。"
  ];

  // level: "must" 必ず／"recommend" あれば／"ifNeeded" その場で手続きするなら
  // focus: 「わからない」の確認に特に必要
  function bringList(r) {
    const unknown = new Set(r.unknown.map(i => i.id));
    const carrierUnknown = CARRIER_ITEM_IDS.some(id => unknown.has(id));
    // 自由入力の契約が「わからない」なら、どこの契約か分からないのでカード明細も強調
    const subsUnknown = SUBS_ITEM_IDS.some(id => unknown.has(id)) || r.unknown.some(i => i.custom);
    const items = [
      { name: "スマホ本体（充電しておく）", why: "ログインの確認コードがSMSで届きます。サブスクの一覧もスマホで確認できます", level: "must", focus: false },
      { name: "キャリアのマイページのID・パスワード（My docomo／My au／My SoftBank など）", why: "オプション契約の確認・解約に使います", level: "must", focus: carrierUnknown },
      { name: "ネットワーク暗証番号（4桁）", why: "契約時に決めた数字です。マイページの操作や手続きで聞かれます", level: "must", focus: carrierUnknown },
      { name: "毎月の請求書・利用明細（紙、またはアプリの画面）", why: "月額とオプションの内訳がひと目でわかります", level: "recommend", focus: carrierUnknown },
      { name: "契約時の書類（契約内容の控え）", why: "加入したオプションと、無料期間の終了日がわかります", level: "recommend", focus: unknown.has("trial") || unknown.has("insurance") },
      { name: "クレジットカードの利用明細", why: "キャリア以外のサブスクの引き落としを見つけられます", level: "recommend", focus: subsUnknown },
      { name: "Apple ID／Googleアカウントのパスワード", why: "サブスクやクラウド容量の確認・変更で入力を求められることがあります", level: "recommend", focus: subsUnknown }
    ];
    if (r.unused.length) {
      items.push({ name: "本人確認書類（運転免許証・マイナンバーカードなど）", why: "その場で解約・プラン変更まで進める場合に必要です", level: "ifNeeded", focus: false });
    }
    return items;
  }

  const api = { SAFETY_QUESTIONS, URGENT_STEPS, scoreSafety, CONTRACT_ITEMS, CONTRACT_HOWTO, evaluateContract, bringList, BRING_NOTES };
  if (typeof module !== "undefined") module.exports = api;
  else root.Checks = api;
})(this);
