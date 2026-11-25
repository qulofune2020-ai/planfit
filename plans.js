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
// checkedAt    : 公式サイトで料金を確認した日
//
// ⚠️ 料金は改定が多いので、公開前に必ず公式サイトで確認してください。
const PLANS = [
  // ── ドコモ ───────────────────────────
  {
    brand: "ドコモ", name: "ドコモ mini（4GB）", price: 2750, data: 4,
    callIncluded: "none", callOptions: { short: 880, unlimited: 1980 },
    store: true, family: true, quality: true, senior: true,
    officialUrl: "https://www.docomo.ne.jp/charge/", checkedAt: "2026-07-22"
  },
  {
    brand: "ドコモ", name: "ドコモ mini（10GB）", price: 3850, data: 10,
    callIncluded: "none", callOptions: { short: 880, unlimited: 1980 },
    store: true, family: true, quality: true, senior: true,
    officialUrl: "https://www.docomo.ne.jp/charge/", checkedAt: "2026-07-22"
  },
  {
    brand: "ドコモ", name: "ドコモ MAX（無制限）", price: 8448, data: 999,
    callIncluded: "none", callOptions: { short: 880, unlimited: 1980 },
    store: true, family: true, quality: true, senior: true,
    officialUrl: "https://www.docomo.ne.jp/charge/", checkedAt: "2026-07-22"
  },
  // ── ahamo ────────────────────────────
  {
    brand: "ahamo", name: "ahamo（30GB）", price: 2970, data: 30,
    callIncluded: "5min", callOptions: { short: 0, unlimited: 1100 },
    store: false, family: false, quality: true, senior: false,
    officialUrl: "https://ahamo.com/", checkedAt: "2026-07-22"
  },
  {
    brand: "ahamo", name: "ahamo 大盛り（110GB）", price: 4950, data: 110,
    callIncluded: "5min", callOptions: { short: 0, unlimited: 1100 },
    store: false, family: false, quality: true, senior: false,
    officialUrl: "https://ahamo.com/", checkedAt: "2026-07-22"
  },
  // ── au ───────────────────────────────
  {
    brand: "au", name: "auの大容量向けプラン（無制限）", price: 8008, data: 999,
    callIncluded: "none", callOptions: { short: 880, unlimited: 1980 },
    store: true, family: true, quality: true, senior: true,
    officialUrl: "https://www.au.com/mobile/charge/", checkedAt: "2026-07-22"
  },
  // ── povo ─────────────────────────────
  {
    brand: "povo", name: "povo2.0（3GBトッピング）", price: 990, data: 3,
    callIncluded: "none", callOptions: { short: 550, unlimited: 1650 },
    store: false, family: false, quality: true, senior: false,
    officialUrl: "https://povo.jp/", checkedAt: "2026-07-22"
  },
  {
    brand: "povo", name: "povo2.0（30GBトッピング）", price: 2700, data: 30,
    callIncluded: "none", callOptions: { short: 550, unlimited: 1650 },
    store: false, family: false, quality: true, senior: false,
    officialUrl: "https://povo.jp/", checkedAt: "2026-07-22"
  },
  // ── UQ mobile ────────────────────────
  {
    brand: "UQ mobile", name: "UQ mobile 小容量プラン（4GB）", price: 2365, data: 4,
    callIncluded: "none", callOptions: { short: 880, unlimited: 1980 },
    store: true, family: true, quality: true, senior: true,
    officialUrl: "https://www.uqwimax.jp/mobile/plan/", checkedAt: "2026-07-22"
  },
  {
    brand: "UQ mobile", name: "UQ mobile 中容量プラン（35GB）", price: 3828, data: 35,
    callIncluded: "10min", callOptions: { short: 0, unlimited: 1100 },
    store: true, family: true, quality: true, senior: true,
    officialUrl: "https://www.uqwimax.jp/mobile/plan/", checkedAt: "2026-07-22"
  },
  // ── SoftBank ─────────────────────────
  {
    brand: "SoftBank", name: "SoftBankの大容量向けプラン（無制限）", price: 7425, data: 999,
    callIncluded: "none", callOptions: { short: 880, unlimited: 1980 },
    store: true, family: true, quality: true, senior: true,
    officialUrl: "https://www.softbank.jp/mobile/price_plan/", checkedAt: "2026-07-22"
  },
  // ── LINEMO ───────────────────────────
  {
    brand: "LINEMO", name: "LINEMO ベストプラン（3GB）", price: 990, data: 3,
    callIncluded: "none", callOptions: { short: 550, unlimited: 1650 },
    store: false, family: false, quality: true, senior: false,
    officialUrl: "https://www.linemo.jp/plan/", checkedAt: "2026-07-22"
  },
  {
    brand: "LINEMO", name: "LINEMO ベストプランV（30GB）", price: 2970, data: 30,
    callIncluded: "5min", callOptions: { short: 0, unlimited: 1100 },
    store: false, family: false, quality: true, senior: false,
    officialUrl: "https://www.linemo.jp/plan/", checkedAt: "2026-07-22"
  },
  // ── Y!mobile ─────────────────────────
  {
    brand: "Y!mobile", name: "Y!mobile 小容量プラン（5GB）", price: 3058, data: 5,
    callIncluded: "none", callOptions: { short: 880, unlimited: 1980 },
    store: true, family: true, quality: true, senior: true,
    officialUrl: "https://www.ymobile.jp/plan/", checkedAt: "2026-07-22"
  },
  {
    brand: "Y!mobile", name: "Y!mobile 中容量プラン（30GB）", price: 4158, data: 30,
    callIncluded: "none", callOptions: { short: 880, unlimited: 1980 },
    store: true, family: true, quality: true, senior: true,
    officialUrl: "https://www.ymobile.jp/plan/", checkedAt: "2026-07-22"
  }
];

// 「今の月額がわからない」ときの推定用：ブランドごとの典型的な月額
// （データ量が多いほど高くなる想定のざっくり値）
const TYPICAL_PRICE = {
  "ドコモ":    { small: 3850, large: 8448 },
  "au":        { small: 4000, large: 8008 },
  "SoftBank":  { small: 4000, large: 7425 },
  "ahamo":     { small: 2970, large: 4950 },
  "povo":      { small: 990,  large: 2700 },
  "UQ mobile": { small: 2365, large: 3828 },
  "LINEMO":    { small: 990,  large: 2970 },
  "Y!mobile":  { small: 3058, large: 4158 },
  "その他":    { small: 4000, large: 7000 }
};

if (typeof module !== "undefined") module.exports = { PLANS, TYPICAL_PRICE };
