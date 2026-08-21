/**
 * naiyo_syoumei_templates.js のプレースホルダー。
 *
 * TODO: 前チャットで動作確認済みの本体コード（5パターンのテンプレート本文＋
 * 差し込みロジック）をここに貼り付けて置き換えること。
 *
 * 内容証明の正式書式（通知書／記／以上）に、rule_engine.js の scenarioData を
 * 差し込んで本文を組み立てる。この層でも法的判断は行わない（確定済みの事実を
 * 文面に反映するのみ）。
 *
 * @typedef {Object} BuiltDocument
 * @property {string} text - 組み立て済みの通知書本文
 * @property {Object} protectedFacts - AI文体調整後もガードレール検証で照合する値
 * @property {string[]} protectedFacts.dates
 * @property {string[]} protectedFacts.amounts
 * @property {string[]} protectedFacts.articleNumbers
 */

/**
 * @param {string} scenarioId
 * @param {Object} scenarioData - rule_engine.evaluateScenario() の scenarioData
 * @param {Record<string, unknown>} facts - ユーザー入力
 * @returns {BuiltDocument}
 */
export function buildDocument(scenarioId, scenarioData, facts) {
  throw new Error(
    `NOT_IMPLEMENTED: templates.js はプレースホルダーです。scenarioId="${scenarioId}" のテンプレートを貼り付けてください。`
  );
}
