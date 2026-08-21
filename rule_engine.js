/**
 * naiyo_syoumei_rule_engine.js のプレースホルダー。
 *
 * TODO: 前チャットで動作確認済みの本体コードをここに貼り付けて置き換えること。
 * 対応予定の4シナリオ（元の指示書より）:
 *   1. 消滅時効の援用（貸金業者）        - 最終取引日から5年経過を機械判定
 *   2. 不倫慰謝料請求                     - 発覚日から3年の消滅時効判定。証拠有無でA/B分岐
 *   3. 残業代・パワハラ・退職トラブル      - 賃金債権3年時効。残り6ヶ月以内は警告
 *   4. 契約解除・クーリングオフ通知        - 契約類型ごとの法定期間（8日/20日）判定
 *
 * 設計原則（厳守）:
 *   - 法的な当否判定はAIを一切使わず、ここで機械的に完結させる。
 *   - 出力は「事実」と「判定結果」のみ。文言・文体の調整はこの層では行わない。
 *
 * @typedef {Object} RuleEngineResult
 * @property {boolean} eligible - 通知書生成を許可してよいか
 * @property {string} scenarioId
 * @property {Object} scenarioData - テンプレート差し込み用の確定事実
 * @property {string[]} warnings - 例: 「時効まで残り6ヶ月以内」等
 * @property {string} [blockedReason] - eligible=false の場合の理由（例: クーリングオフ期間超過）
 */

/**
 * @param {string} scenarioId
 * @param {Record<string, unknown>} facts
 * @returns {RuleEngineResult}
 */
export function evaluateScenario(scenarioId, facts) {
  throw new Error(
    `NOT_IMPLEMENTED: rule_engine.js はプレースホルダーです。scenarioId="${scenarioId}" の判定ロジックを貼り付けてください。`
  );
}

export const SUPPORTED_SCENARIOS = [
  "loan_prescription", // 消滅時効の援用（貸金業者）
  "affair_compensation", // 不倫慰謝料請求
  "labor_dispute", // 残業代・パワハラ・退職トラブル
  "contract_cooling_off", // 契約解除・クーリングオフ通知
];
