import { evaluateScenario, SUPPORTED_SCENARIOS } from "./rule_engine.js";
import { buildDocument } from "./templates.js";
import { polishText } from "./ai_polish.js";

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

    if (request.method === "POST" && url.pathname === "/api/generate") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "invalid_json" }, 400, cors);
      }

      const { scenarioId, facts, useMock } = body ?? {};
      if (!scenarioId || !SUPPORTED_SCENARIOS.includes(scenarioId)) {
        return json({ error: "unsupported_scenario", scenarioId }, 400, cors);
      }

      try {
        const ruleResult = evaluateScenario(scenarioId, facts ?? {});
        if (!ruleResult.eligible) {
          return json(
            { error: "blocked_by_rule_engine", reason: ruleResult.blockedReason, warnings: ruleResult.warnings },
            422,
            cors
          );
        }

        const doc = buildDocument(scenarioId, ruleResult.scenarioData, facts ?? {});

        const polished = await polishText({
          text: doc.text,
          protectedFacts: doc.protectedFacts,
          apiKey: env.ANTHROPIC_API_KEY,
          useMock: Boolean(useMock),
        });

        return json(
          {
            scenarioId,
            warnings: ruleResult.warnings,
            text: polished.text,
            guardrailPassed: polished.guardrailPassed,
            usedAi: polished.usedAi,
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
