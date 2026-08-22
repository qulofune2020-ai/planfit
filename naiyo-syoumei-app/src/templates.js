第710条"],
  },
  furin_isharyou_patternB_v1: { dateKeys: ["discoveryDate"], amountKeys: [], articleNumbers: [] },
  zangyou_pawahara_v1: { dateKeys: ["lastPayDate"], amountKeys: ["unpaidAmount"], articleNumbers: ["労働基準法第37条"] },
  cooling_off_v1: { dateKeys: ["contractDate"], amountKeys: ["paidAmount"], articleNumbers: ["特定商取引法"] },
};

export function buildProtectedFacts(evaluation, common) {
  const config = PROTECTED_FACTS_CONFIG[evaluation.templateId];
  if (!config) {
    return { dates: [], amounts: [], articleNumbers: [] };
  }

  const vars = formatVars(evaluation.vars);

  const dates = config.dateKeys.map((key) => vars[key]).filter(Boolean);
  if (common?.documentDate) {
    dates.push(common.documentDate);
  }

  const amounts = config.amountKeys
    .map((key) => vars[key])
    .filter(Boolean)
    .map((amount) => `金${amount}円`);

  return { dates, amounts, articleNumbers: config.articleNumbers };
}

export function buildDocument(evaluation, common) {
  const text = renderTemplate(evaluation, common);
  const protectedFacts = buildProtectedFacts(evaluation, common);
  return { text, protectedFacts };
}
