const TEMPLATES = {
  jikou_enyou_v1: `通知書

前略、貴社に対し下記の通り通知いたします。

記

貴社と当職依頼者との間の下記債権（契約番号：{{contractNo}}）について、
最終取引日である{{lastTransactionDate}}より既に{{elapsedYears}}年が経過しており、
消滅時効期間が満了しております。

つきましては、民法第166条の規定に基づき、当職依頼者は上記債権について
消滅時効を援用いたします。

本通知到達後は、上記債権に基づく請求・督促を一切お控えいただきますよう、
併せて申し入れいたします。

以上

{{documentDate}}

通知人：{{senderName}}
被通知人：{{companyName}} 御中`,

  furin_isharyou_patternA_v1: `通知書

前略、貴殿に対し下記の通り通知いたします。

記

貴殿は、{{discoveryDate}}頃までの間、当職依頼者の配偶者と不貞関係にあった
事実が、当職依頼者の保有する証拠（{{evidenceTypesText}}）により認められます。

当職依頼者は貴殿の上記行為により多大な精神的苦痛を被りました。
つきましては、民法第709条及び第710条の規定に基づき、慰謝料として
金{{requestedAmount}}円の支払いを求めます。

本書面到達後2週間以内に、下記いずれかの方法でご回答ください。
・支払いに応じる旨のご連絡
・ご事情の説明を含むご回答

期限内にご回答・ご対応がない場合、法的手続を検討せざるを得ませんので、
あらかじめ申し添えます。

以上

{{documentDate}}

通知人：{{senderName}}
被通知人：{{recipientName}} 殿`,

  furin_isharyou_patternB_v1: `通知書

前略、貴殿に対し下記の通り通知いたします。

記

当職依頼者は、貴殿と当職依頼者の配偶者との間に、{{discoveryDate}}頃から
不適切な関係があったのではないかとの懸念を抱いております。

つきましては、上記の事実関係について、書面にてご回答いただきたく存じます。
ご回答内容によっては、あらためて協議の場を設けさせていただく可能性が
ございます。

本書面到達後2週間以内に、下記いずれかの方法でご回答ください。
・事実関係についての具体的なご説明
・協議に応じる旨のご連絡

以上

{{documentDate}}

通知人：{{senderName}}
被通知人：{{recipientName}} 殿`,

  zangyou_pawahara_v1: `通知書

前略、貴社に対し下記の通り通知いたします。

記

当職依頼者は、{{lastPayDate}}時点において貴社に在籍しておりました。
在籍中、下記の未払い賃金等が発生しております。

・請求内容：{{claimTypesText}}
・未払額（概算）：金{{unpaidAmount}}円

つきましては、労働基準法第37条及び民法の規定に基づき、上記金額の
支払いを求めます。

本書面到達後2週間以内に、下記いずれかの方法でご回答ください。
・支払いに応じる旨のご連絡
・未払額についてのご説明・資料のご提示

期限内にご回答・お支払いがない場合、労働基準監督署への申告、
または法的手続を検討せざるを得ませんので、あらかじめ申し添えます。

以上

{{documentDate}}

通知人：{{senderName}}
被通知人：{{companyName}} 御中`,

  cooling_off_v1: `通知書

前略、貴社に対し下記の通り通知いたします。

記

当職依頼者は、{{contractDate}}に貴社との間で締結した下記契約について、
特定商取引法の規定に基づき、クーリングオフによる解除を通知いたします。

・契約内容：{{productName}}
・既払金額：金{{paidAmount}}円

つきましては、上記契約を解除するとともに、既払金全額の返還を求めます。

なお、本通知は契約解除の効力発生要件である法定期間内に発送しております。

以上

{{documentDate}}

通知人：{{senderName}}
被通知人：{{companyName}} 御中`,
};

const EVIDENCE_LABELS = {
  line: "LINE等のメッセージ履歴",
  photo: "写真",
  detective: "探偵による調査報告書",
  witness: "目撃者の証言",
};

const CLAIM_TYPE_LABELS = {
  overtime: "未払い残業代",
  unpaid_wage: "未払い賃金",
  harassment: "パワーハラスメントに基づく慰謝料",
};

function formatEvidenceTypes(evidenceTypes = []) {
  return evidenceTypes.map((t) => EVIDENCE_LABELS[t] || t).join("・");
}

function formatClaimTypes(claimTypes = []) {
  return claimTypes.map((t) => CLAIM_TYPE_LABELS[t] || t).join("、");
}

const AMOUNT_KEYS = ["debtAmount", "requestedAmount", "unpaidAmount", "paidAmount"];

function formatVars(rawVars) {
  const vars = { ...rawVars };
  if (vars.evidenceTypes) {
    vars.evidenceTypesText = formatEvidenceTypes(vars.evidenceTypes);
  }
  if (vars.claimTypes) {
    vars.claimTypesText = formatClaimTypes(vars.claimTypes);
  }
  AMOUNT_KEYS.forEach((key) => {
    if (typeof vars[key] === "number") {
      vars[key] = vars[key].toLocaleString("ja-JP");
    }
  });
  return vars;
}

export function renderTemplate(evaluation, common) {
  if (evaluation.blocked) {
    throw new Error(
      `このシナリオは生成をブロックされています: ${evaluation.pattern}\n理由: ${evaluation.warnings.join(" / ")}`
    );
  }

  const template = TEMPLATES[evaluation.templateId];
  if (!template) {
    throw new Error(`テンプレートが見つかりません: ${evaluation.templateId}`);
  }

  const vars = { ...formatVars(evaluation.vars), ...common };

  let rendered = template;
  const unresolved = [];
  rendered = rendered.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (match, key) => {
    if (vars[key] === undefined || vars[key] === null || vars[key] === "") {
      unresolved.push(key);
      return match;
    }
    return String(vars[key]);
  });

  if (unresolved.length > 0) {
    throw new Error(`未入力の変数が残っています: ${unresolved.join(", ")}`);
  }

  return rendered;
}

const PROTECTED_FACTS_CONFIG = {
  jikou_enyou_v1: { dateKeys: ["lastTransactionDate"], amountKeys: [], articleNumbers: ["民法第166条"] },
  furin_isharyou_patternA_v1: {
    dateKeys: ["discoveryDate"],
    amountKeys: ["requestedAmount"],
    articleNumbers: ["民法第709条及び
