/**
 * Stripe REST APIへの薄いラッパー。Stripe公式SDKは使わず fetch で直接叩く
 * （Workers環境で軽量に動かすため）。Stripe APIは application/x-www-form-urlencoded
 * かつネストしたオブジェクト/配列は角括弧記法（例: line_items[0][quantity]）を要求する。
 */

const STRIPE_API_URL = "https://api.stripe.com/v1";

/**
 * ネストしたオブジェクト/配列を Stripe が要求する角括弧記法の
 * application/x-www-form-urlencoded 文字列に変換する。
 */
export function toFormParams(obj, prefix = "") {
  const params = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue;
    const paramKey = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        params.push(...toFormParams({ [i]: item }, paramKey));
      });
    } else if (typeof value === "object") {
      params.push(...toFormParams(value, paramKey));
    } else {
      params.push(`${encodeURIComponent(paramKey)}=${encodeURIComponent(value)}`);
    }
  }
  return params;
}

async function stripeRequest(secretKey, method, path, body) {
  const headers = { authorization: `Bearer ${secretKey}` };
  let requestBody;
  if (body) {
    headers["content-type"] = "application/x-www-form-urlencoded";
    requestBody = toFormParams(body).join("&");
  }

  const response = await fetch(`${STRIPE_API_URL}${path}`, { method, headers, body: requestBody });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Stripe API error: ${data.error?.message || response.status}`);
  }
  return data;
}

/**
 * @param {Object} params
 * @param {string} params.secretKey
 * @param {string} params.priceLabel - Stripeのチェックアウト画面に表示される商品名
 * @param {number} params.amountJpy - 円建て金額（JPYはゼロデシマル通貨なのでそのまま渡す）
 * @param {string} params.successUrl
 * @param {string} params.cancelUrl
 * @param {Record<string, string>} params.metadata
 */
export async function createCheckoutSession({ secretKey, priceLabel, amountJpy, successUrl, cancelUrl, metadata }) {
  return stripeRequest(secretKey, "POST", "/checkout/sessions", {
    mode: "payment",
    success_url: successUrl,
    cancel_url: cancelUrl,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "jpy",
          unit_amount: amountJpy,
          product_data: { name: priceLabel },
        },
      },
    ],
    metadata,
  });
}

export async function retrieveCheckoutSession({ secretKey, sessionId }) {
  return stripeRequest(secretKey, "GET", `/checkout/sessions/${encodeURIComponent(sessionId)}`);
}
