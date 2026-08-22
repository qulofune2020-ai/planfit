const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-5";

const SYSTEM_PROMPT = "あなたは内容証明郵便の文面を整える文体調整アシスタントです。以下のルールを厳守してください。1. 入力された文書に含まれる事実（日付・金額・当事者名・条文番号・法的判定結果）は一切変更しないでください。追加・削除・言い換えも禁止です。2. あなたの役割は文体・言い回しの自然さの調整のみです。法的な当否判断は行わないでください。3. 証拠が不十分である旨が入力に明記されている場合、断定的な請求表現を避け、協議を申し入れるトーンにしてください。4. 「交渉代行」「代理」を想起させる一人称表現（例:「私が交渉します」）は使わないでください。常に「書面作成の支援」という立場を維持してください。5. 出力は調整後の本文のみとし、前置きや説明文は付けないでください。";

export async function polishText({
  text,
  protectedFacts = {},
  apiKey,
  useMock = false,
  model = DEFAULT_MODEL,
}) {
  if (useMock) {
    return { text, guardrailPassed: true, usedAi: false, original: text };
  }

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY が設定されていません。");
  }

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: text }],
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    throw new Error("Anthropic API error: " + response.status + " " + errBody);
  }

  const data = await response.json();
  const polished = (data.content ?? [])
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  const guardrailPassed = checkGuardrail(polished, protectedFacts);

  return {
    text: guardrailPassed ? polished : text,
    guardrailPassed,
    usedAi: guardrailPassed,
    original: text,
  };
}

export function checkGuardrail(polishedText, protectedFacts) {
  const allValues = [
    ...(protectedFacts.dates ?? []),
    ...(protectedFacts.amounts ?? []),
    ...(protectedFacts.articleNumbers ?? []),
  ];

  return allValues.every((value) => polishedText.includes(value));
}
