// 料金プランデータ（税込・割引前の基本料金。端末代は含まない）
//
// price        : 月額基本料（円）
// data         : 月間データ容量（GB）。999 = 無制限
// callIncluded : 料金に含まれる通話  "none" | "5min" | "10min" | "unlimited"
// callOptions  : 通話オプションの追加料金 { short: 短時間かけ放題, unlimited: 完全かけ放題 }
//                含まれている場合は 0、提供なしは null
// store        : 店舗サポートあり
// family       : 家族割・家族向け割引あり
// quality      : 大手キャリア回線（全プラン true。将来の拡張用）
// senior       : シニア向け割引・サポートあり
// checkedAt    : 料金を確認した日
// note         : 注意書き（任意）。診断結果の注意点に表示される
// verified     : false = 公式サイトで直接確認できていない（比較サイト等の二次情報）
//
// ⚠️ 料金は改定が多いので、公開前に必ず公式サイトで確認してください。
const PLANS = [
  // ── ドコモ（2026-12-01 料金改定後）──
  {
    brand: "ドコモ", name: "ドコモ mini2（6GB）", price: 3278, data: 6,
    callIncluded: "none", callOptions: { short: 880, unlimited: 1980 },
    store: true, family: true, quality: true, senior: true,
    officialUrl: "https://www.docomo.ne.jp/charge/docomo_mini2/", checkedAt: "2026-11-25",
    note: "2026年12月1日提供開始のプラン"
  },
  {
    brand: "ドコモ", name: "ドコモ mini2（12GB）", price: 4598, data: 12,
    callIncluded: "none", callOptions: { short: 880, unlimited: 1980 },
    store: true, family: true, quality: true, senior: true,
    officialUrl: "https://www.docomo.ne.jp/charge/docomo_mini2/", checkedAt: "2026-11-25",
    note: "2026年12月1日提供開始のプラン"
  },
  {
    brand: "ドコモ", name: "ドコモ MAX（無制限）", price: 8448, data: 999,
    callIncluded: "none", callOptions: { short: 880, unlimited: 1980 },
    store: true, family: true, quality: true, senior: true,
    officialUrl: "https://www.docomo.ne.jp/charge/docomo_max/", checkedAt: "2026-11-25"
  },
  // ── ahamo（2026-12-01 料金改定後）──
  {
    brand: "ahamo", name: "ahamo（40GB）", price: 3135, data: 40,
    callIncluded: "5min", callOptions: { short: 0, unlimited: 1100 },
    store: false, family: false, quality: true, senior: false,
    officialUrl: "https://ahamo.com/plan/", checkedAt: "2026-11-25",
    note: "2026年12月1日からの新料金"
  },
  {
    brand: "ahamo", name: "ahamo（60GB）", price: 4125, data: 60,
    callIncluded: "5min", callOptions: { short: 0, unlimited: 1100 },
    store: false, family: false, quality: true, senior: false,
    officialUrl: "https://ahamo.com/plan/", checkedAt: "2026-11-25",
    note: "2026年12月1日からの新料金"
  },
  {
    brand: "ahamo", name: "ahamo（120GB）", price: 5115, data: 120,
    callIncluded: "5min", callOptions: { short: 0, unlimited: 1100 },
    store: false, family: false, quality: true, senior: false,
    officialUrl: "https://ahamo.com/plan/", checkedAt: "2026-11-25",
    note: "2026年12月1日からの新料金"
  },
  // ── au ──
  {
    brand: "au", name: "auバリューリンクプラン（無制限）", price: 8008, data: 999,
    callIncluded: "none", callOptions: { short: 880, unlimited: 1980 },
    store: true, family: true, quality: true, senior: true,
    officialUrl: "https://www.au.com/mobile/charge/smartphone/plan/auvaluelink/", checkedAt: "2026-11-25"
  },
  // ── povo（基本料0円＋データトッピング）──
  {
    brand: "povo", name: "povo2.0（3GB/30日トッピング）", price: 990, data: 3,
    callIncluded: "none", callOptions: { short: 550, unlimited: 1650 },
    store: false, family: false, quality: true, senior: false,
    officialUrl: "https://povo.jp/spec/detail/", checkedAt: "2026-11-25"
  },
  {
    brand: "povo", name: "povo2.0（30GB/30日トッピング）", price: 2780, data: 30,
    callIncluded: "none", callOptions: { short: 550, unlimited: 1650 },
    store: false, family: false, quality: true, senior: false,
    officialUrl: "https://povo.jp/spec/detail/", checkedAt: "2026-11-25"
  },
  // ── UQ mobile ──
  {
    brand: "UQ mobile", name: "UQ mobile トクトクプラン2（30GB）", price: 4048, data: 30,
    callIncluded: "none", callOptions: { short: 880, unlimited: 1980 },
    store: true, family: true, quality: true, senior: true,
    officialUrl: "https://www.uqwimax.jp/mobile/plan/tokutoku2/", checkedAt: "2026-11-25"
  },
  {
    brand: "UQ mobile", name: "UQ mobile コミコミプランバリュー（35GB）", price: 3828, data: 35,
    callIncluded: "10min", callOptions: { short: 0, unlimited: 1100 },
    store: true, family: true, quality: true, senior: true,
    officialUrl: "https://www.uqwimax.jp/mobile/plan/komikomi-pv/", checkedAt: "2026-11-25"
  },
  // ── SoftBank ──
  {
    brand: "SoftBank", name: "SoftBank ミニフィット2（5GB）", price: 6358, data: 5,
    callIncluded: "none", callOptions: { short: 880, unlimited: 1980 },
    store: true, family: true, quality: true, senior: true,
    officialUrl: "https://www.softbank.jp/mobile/price_plan/", checkedAt: "2026-11-25"
  },
  {
    brand: "SoftBank", name: "SoftBank テイガク無制限", price: 8008, data: 999,
    callIncluded: "none", callOptions: { short: 880, unlimited: 1980 },
    store: true, family: true, quality: true, senior: true,
    officialUrl: "https://www.softbank.jp/mobile/price_plan/data/teigaku-museigen/", checkedAt: "2026-11-25"
  },
  // ── LINEMO（基本料金は公式サイトで確認済み）──
  {
    brand: "LINEMO", name: "LINEMO ベストプラン（3GB）", price: 990, data: 3,
    callIncluded: "none", callOptions: { short: 550, unlimited: 1650 },
    store: false, family: false, quality: true, senior: false,
    officialUrl: "https://www.linemo.jp/plan/", checkedAt: "2026-11-25"
  },
  {
    brand: "LINEMO", name: "LINEMO ベストプラン（10GB）", price: 2090, data: 10,
    callIncluded: "none", callOptions: { short: 550, unlimited: 1650 },
    store: false, family: false, quality: true, senior: false,
    officialUrl: "https://www.linemo.jp/plan/", checkedAt: "2026-11-25"
  },
  {
    brand: "LINEMO", name: "LINEMO ベストプランV（30GB）", price: 2970, data: 30,
    callIncluded: "5min", callOptions: { short: 0, unlimited: 1100 },
    store: false, family: false, quality: true, senior: false,
    officialUrl: "https://www.linemo.jp/plan/", checkedAt: "2026-11-25"
  },
  // ── Y!mobile（基本料金は公式サイトで確認済み）──
  {
    brand: "Y!mobile", name: "Y!mobile シンプル3 S（5GB）", price: 3278, data: 5,
    callIncluded: "none", callOptions: { short: 880, unlimited: 1980 },
    store: true, family: true, quality: true, senior: true,
    officialUrl: "https://www.ymobile.jp/plan/", checkedAt: "2026-11-25"
  },
  {
    brand: "Y!mobile", name: "Y!mobile シンプル3 M（30GB）", price: 4378, data: 30,
    callIncluded: "none", callOptions: { short: 880, unlimited: 1980 },
    store: true, family: true, quality: true, senior: true,
    officialUrl: "https://www.ymobile.jp/plan/", checkedAt: "2026-11-25"
  },
  {
    brand: "Y!mobile", name: "Y!mobile シンプル3 L（35GB）", price: 5478, data: 35,
    callIncluded: "none", callOptions: { short: 880, unlimited: 1980 },
    store: true, family: true, quality: true, senior: true,
    officialUrl: "https://www.ymobile.jp/plan/", checkedAt: "2026-11-25"
  }
];

// 「今の月額がわからない」ときの推定用：ブランドごとの典型的な月額（割引前）
const TYPICAL_PRICE = {
  "ドコモ":    { small: 3278, large: 8448 },
  "au":        { small: 4928, large: 8008 },
  "SoftBank":  { small: 6358, large: 8008 },
  "ahamo":     { small: 3135, large: 4125 },
  "povo":      { small: 990,  large: 2780 },
  "UQ mobile": { small: 3828, large: 4048 },
  "LINEMO":    { small: 990,  large: 2970 },
  "Y!mobile":  { small: 3278, large: 4378 },
  "その他":    { small: 4000, large: 7000 }
};

if (typeof module !== "undefined") module.exports = { PLANS, TYPICAL_PRICE };
