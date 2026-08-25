import { evaluateScenario, SUPPORTED_SCENARIOS } from "./rule_engine.js";
import { buildDocument } from "./templates.js";
import { polishText } from "./ai_polish.js";
import { SCENARIO_PRICES_JPY, SCENARIO_LABELS } from "./pricing.js";
import { createCheckoutSession, retrieveCheckoutSession } from "./stripe.js";

function corsHeaders(request, env) {
  const allowed = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const origin = request.headers.get("origin");
  const allowOrigin = allowed.includes(origin) ? origin : allowed[0] || "";
  return {
    "access-control-allow-origin": allowOrigin,
    "access-control-allow-methods": "POST, GET, OPTIONS",
    "access-control-allow-headers": "content-type",
    vary: "origin",
  };
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

/**
 * ALLOWED_ORIGINSのいずれかと同一オリジンかを確認する。
 * Stripe Checkoutのsuccess_url/cancel_urlに任意の外部URLを
 * 指定できてしまうこと（オープンリダイレクト）を防ぐため。
 */
function isAllowedRedirectUrl(urlString, env) {
  const allowed = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  try {
    const origin = new URL(urlString).origin;
    return allowed.includes(origin);
  } catch {
    return false;
  }
}

/**
 * ルール判定→テンプレート差し込み→AI文体調整 の共通パイプライン。
 * /api/generate（テスト用）と /api/checkout/result（決済後の本生成）の両方から使う。
 */
async function runPipeline({ scenarioId, facts, common, apiKey, useMock }) {
  const evaluation = evaluateScenario(scenarioId, facts ?? {});
  if (evaluation.blocked) {
    return { blocked: true, evaluation };
  }

  const doc = buildDocument(evaluation, common);
  const polished = await polishText({
    text: doc.text,
    protectedFacts: doc.protectedFacts,
    apiKey,
    useMock: Boolean(useMock),
  });

  return { blocked: false, evaluation, polished };
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    if (request.method === "GET" && url.pathname === "/api/health") {
      return json({ ok: true, scenarios: SUPPORTED_SCENARIOS }, 200, cors);
    }

    if (request.method === "GET" && url.pathname === "/api/pricing") {
      return json({ prices: SCENARIO_PRICES_JPY, labels: SCENARIO_LABELS }, 200, cors);
    }

    if (request.method === "POST" && url.pathname === "/api/generate") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "invalid_json" }, 400, cors);
      }

      const { scenarioId, facts, senderName, recipientName, documentDate, useMock } = body ?? {};
      if (!scenarioId || !SUPPORTED_SCENARIOS.includes(scenarioId)) {
        return json({ error: "unsupported_scenario", scenarioId }, 400, cors);
      }

      try {
        const common = {
          senderName,
          recipientName,
          documentDate: documentDate || new Date().toISOString().slice(0, 10),
        };

        const result = await runPipeline({ scenarioId, facts, common, apiKey: env.ANTHROPIC_API_KEY, useMock });

        if (result.blocked) {
          return json(
            { error: "blocked_by_rule_engine", pattern: result.evaluation.pattern, warnings: result.evaluation.warnings },
            422,
            cors
          );
        }

        return json(
          {
            scenarioId,
            pattern: result.evaluation.pattern,
            warnings: result.evaluation.warnings,
            text: result.polished.text,
            guardrailPassed: result.polished.guardrailPassed,
            usedAi: result.polished.usedAi,
          },
          200,
          cors
        );
      } catch (err) {
        return json({ error: "internal_error", message: String(err?.message ?? err) }, 500, cors);
      }
    }
    
    // 決済導線: フォーム送信 → まずルールエンジンで生成可否を判定し、
    // ブロックされる案件（時効未成立・期間超過等）には課金しない。
    // 問題なければStripe Checkoutセッションを作成してURLを返す。
    if (request.method === "POST" && url.pathname === "/api/checkout") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "invalid_json" }, 400, cors);
      }

      const { scenarioId, facts, senderName, recipientName, documentDate, successUrl, cancelUrl } = body ?? {};

      if (!scenarioId || !SUPPORTED_SCENARIOS.includes(scenarioId)) {
        return json({ error: "unsupported_scenario", scenarioId }, 400, cors);
      }
      if (!env.STRIPE_SECRET_KEY) {
        return json({ error: "stripe_not_configured" }, 500, cors);
      }
      if (!isAllowedRedirectUrl(successUrl, env) || !isAllowedRedirectUrl(cancelUrl, env)) {
        return json({ error: "invalid_redirect_url" }, 400, cors);
      }

      try {
        const evaluation = evaluateScenario(scenarioId, facts ?? {});
        if (evaluation.blocked) {
          return json(
            { error: "blocked_by_rule_engine", pattern: evaluation.pattern, warnings: evaluation.warnings },
            422,
            cors
          );
        }

        const separator = successUrl.includes("?") ? "&" : "?";
        const successUrlWithSession = `${successUrl}${separator}session_id={CHECKOUT_SESSION_ID}`;

        const session = await createCheckoutSession({
          secretKey: env.STRIPE_SECRET_KEY,
          priceLabel: `内容証明 書面作成支援 - ${SCENARIO_LABELS[scenarioId]}`,
          amountJpy: SCENARIO_PRICES_JPY[scenarioId],
          successUrl: successUrlWithSession,
          cancelUrl,
          metadata: {
            scenarioId,
            facts_json: JSON.stringify(facts ?? {}),
            senderName: senderName || "",
            recipientName: recipientName || "",
            documentDate: documentDate || "",
          },
        });

        return json({ checkoutUrl: session.url }, 200, cors);
      } catch (err) {
        return json({ error: "checkout_error", message: String(err?.message ?? err) }, 500, cors);
      }
    }
    
    // 決済完了後: Stripe側でセッションの支払い状況をサーバー間で検証してから、
    // メタデータに保存しておいた入力内容で実際に文書を生成する。
    if (request.method === "GET" && url.pathname === "/api/checkout/result") {
      const sessionId = url.searchParams.get("session_id");
      if (!sessionId) {
        return json({ error: "missing_session_id" }, 400, cors);
      }
      if (!env.STRIPE_SECRET_KEY) {
        return json({ error: "stripe_not_configured" }, 500, cors);
      }

      try {
        const session = await retrieveCheckoutSession({ secretKey: env.STRIPE_SECRET_KEY, sessionId });

        if (session.payment_status !== "paid") {
          return json({ paid: false, status: session.payment_status }, 402, cors);
        }

        const scenarioId = session.metadata?.scenarioId;
        if (!scenarioId || !SUPPORTED_SCENARIOS.includes(scenarioId)) {
          return json({ error: "invalid_session_metadata" }, 500, cors);
        }

        const facts = JSON.parse(session.metadata.facts_json || "{}");
        const common = {
          senderName: session.metadata.senderName || undefined,
          recipientName: session.metadata.recipientName || undefined,
          documentDate: session.metadata.documentDate || new Date().toISOString().slice(0, 10),
        };

        const result = await runPipeline({ scenarioId, facts, common, apiKey: env.ANTHROPIC_API_KEY, useMock: false });

        if (result.blocked) {
          // 決済時点では生成可能だったが、時間経過（法定期間の境界等）で
          // 状況が変わったケース。返金対応が必要なため明示的にフラグを立てる。
          return json(
            {
              paid: true,
              blocked: true,
              pattern: result.evaluation.pattern,
              warnings: result.evaluation.warnings,
              needsRefund: true,
            },
            422,
            cors
          );
        }

        return json(
          {
            paid: true,
            scenarioId,
            pattern: result.evaluation.pattern,
            warnings: result.evaluation.warnings,
            text: result.polished.text,
            guardrailPassed: result.polished.guardrailPassed,
            usedAi: result.polished.usedAi,
          },
          200,
          cors
        );
      } catch (err) {
        return json({ error: "internal_error", message: String(err?.message ?? err) }, 500, cors);
      }
    }

    return json({ error: "not_found" }, 404, cors);
  },
};
