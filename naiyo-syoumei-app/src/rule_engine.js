/**
 * 内容証明自動作成アプリ - シナリオ別ルールエンジン
 *
 * 設計思想:
 *   AIには「確定済みのパターン（テンプレートID・変数）」だけを渡す。
 *   時効判定・法定期間判定などの法的な当否はこのファイル内で
 *   機械的に完結させ、AIに解釈させない。
 *
 *   各 evaluate 関数は { blocked, pattern, templateId, warnings, vars }
 *   という共通シェイプを返す。blocked=true の場合、文書生成自体を
 *   行わずユーザーに案内文を表示する。
 */

// ---------------------------------------------------------------
// 共通ユーティリティ
// ---------------------------------------------------------------

/** 2つの日付(YYYY-MM-DD文字列)の経過年数を返す */
function yearsSince(dateStr, asOf = new Date()) {
  const from = new Date(dateStr);
  const diffMs = asOf - from;
  return diffMs / (1000 * 60 * 60 * 24 * 365.25);
}

/** 2つの日付の経過日数を返す */
function daysSince(dateStr, asOf = new Date()) {
  const from = new Date(dateStr);
  const diffMs = asOf - from;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

// ---------------------------------------------------------------
// シナリオ1: 消滅時効の援用（貸金業者）
// ---------------------------------------------------------------

export function evaluateJikouEnyou(input) {
  const { companyName, contractNo, lastTransactionDate, debtAmount, hasInterruption } = input;
  const elapsedYears = yearsSince(lastTransactionDate);
  const REQUIRED_YEARS = 5;

  if (hasInterruption) {
    return {
      blocked: true,
      pattern: "interruption_detected",
      templateId: null,
      warnings: ["時効中断事由（承認・訴訟等）が申告されています。時効援用は困難な可能性が高いため、行政書士への個別相談へ誘導してください。"],
      vars: {},
    };
  }

  if (elapsedYears < REQUIRED_YEARS) {
    return {
      blocked: true,
      pattern: "not_yet_expired",
      templateId: null,
      warnings: [`最終取引日から${elapsedYears.toFixed(1)}年しか経過していません（必要年数: ${REQUIRED_YEARS}年）。時効はまだ成立していない可能性があります。`],
      vars: {},
    };
  }

  return {
    blocked: false,
    pattern: "jikou_enyou_valid",
    templateId: "jikou_enyou_v1",
    warnings: [],
    vars: { companyName, contractNo, lastTransactionDate, debtAmount, elapsedYears: elapsedYears.toFixed(1) },
  };
}

// ---------------------------------------------------------------
// シナリオ2: 不倫慰謝料請求
// ---------------------------------------------------------------

export function evaluateFurinIsharyou(input) {
  const { target, discoveryDate, evidenceTypes, marriageYears, requestedAmount } = input;
  const elapsedYears = yearsSince(discoveryDate);
  const SHOUMETSU_JIKOU_YEARS = 3;

  if (elapsedYears >= SHOUMETSU_JIKOU_YEARS) {
    return {
      blocked: true,
      pattern: "time_barred",
      templateId: null,
      warnings: [`発覚日から${elapsedYears.toFixed(1)}年経過しており、消滅時効（3年）の可能性があります。行政書士への個別相談を案内してください。`],
      vars: {},
    };
  }

  const hasEvidence = Array.isArray(evidenceTypes) && evidenceTypes.length > 0;

  if (hasEvidence) {
    return {
      blocked: false,
      pattern: "assertive_claim",
      templateId: "furin_isharyou_patternA_v1",
      warnings: [],
      vars: { target, discoveryDate, evidenceTypes, marriageYears, requestedAmount },
    };
  }

  return {
    blocked: false,
    pattern: "cautious_inquiry",
    templateId: "furin_isharyou_patternB_v1",
    warnings: ["証拠未申告のため、断定的な請求文ではなく協議申入れ文に自動的に切り替えています。"],
    vars: { target, discoveryDate, marriageYears },
  };
}

// ---------------------------------------------------------------
// シナリオ3: 残業代・パワハラ・退職トラブル
// ---------------------------------------------------------------

export function evaluateZangyouPawahara(input) {
  const { companyName, claimTypes, lastPayDate, retirementDate, unpaidAmount, harassmentMonths } = input;
  const WAGE_TIME_LIMIT_YEARS = 3;
  const elapsedYears = yearsSince(lastPayDate);
  const remainingYears = WAGE_TIME_LIMIT_YEARS - elapsedYears;

  if (elapsedYears >= WAGE_TIME_LIMIT_YEARS) {
    return {
      blocked: true,
      pattern: "wage_time_barred",
      templateId: null,
      warnings: [`最終給料日から${elapsedYears.toFixed(1)}年経過しており、賃金債権の消滅時効（3年）の可能性があります。`],
      vars: {},
    };
  }

  const urgent = remainingYears <= 0.5;

  return {
    blocked: false,
    pattern: urgent ? "urgent_claim" : "standard_claim",
    templateId: "zangyou_pawahara_v1",
    warnings: urgent ? [`時効まで残り約${(remainingYears * 12).toFixed(0)}ヶ月です。至急発送を推奨する警告をユーザーに表示してください。`] : [],
    vars: { companyName, claimTypes, lastPayDate, retirementDate, unpaidAmount, harassmentMonths, urgent },
  };
}

// ---------------------------------------------------------------
// シナリオ4: 契約解除・クーリングオフ通知
// ---------------------------------------------------------------

export const COOLING_OFF_PERIODS = {
  door_to_door: 8,
  phone_solicitation: 8,
  multilevel_marketing: 20,
  continuous_service: 8,
};

export function evaluateCoolingOff(input) {
  const { companyName, contractDate, contractType, productName, paidAmount } = input;
  const limitDays = COOLING_OFF_PERIODS[contractType];

  if (!limitDays) {
    return {
      blocked: true,
      pattern: "unknown_contract_type",
      templateId: null,
      warnings: [`未対応の契約類型です: ${contractType}`],
      vars: {},
    };
  }

  const elapsedDays = daysSince(contractDate);

  if (elapsedDays > limitDays) {
    return {
      blocked: true,
      pattern: "period_expired",
      templateId: null,
      warnings: [`契約日から${elapsedDays}日経過しており、クーリングオフ法定期間（${limitDays}日）を超えています。別の解除方法のご案内に切り替えてください。`],
      vars: {},
    };
  }

  return {
    blocked: false,
    pattern: "cooling_off_valid",
    templateId: "cooling_off_v1",
    warnings: [],
    vars: { companyName, contractDate, contractType, productName, paidAmount, remainingDays: limitDays - elapsedDays },
  };
}

// ---------------------------------------------------------------
// ディスパッチャー
// ---------------------------------------------------------------

const SCENARIOS = {
  jikou_enyou: evaluateJikouEnyou,
  furin_isharyou: evaluateFurinIsharyou,
  zangyou_pawahara: evaluateZangyouPawahara,
  cooling_off: evaluateCoolingOff,
};

export const SUPPORTED_SCENARIOS = Object.keys(SCENARIOS);

export function evaluateScenario(scenarioId, input) {
  const fn = SCENARIOS[scenarioId];
  if (!fn) {
    throw new Error(`未対応のシナリオID: ${scenarioId}`);
  }
  return fn(input);
}
