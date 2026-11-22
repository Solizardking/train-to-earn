/**
 * Hosted inference config for the Hau Hau model.
 *
 * The model is served by llama.cpp on a GPU host and fronted by the Musebook
 * AI gateway (OpenAI-compatible). Base URL and model id are env-driven so the
 * site can be pointed at the gateway — or directly at a llama-server — without
 * code changes:
 *
 *   VITE_HAUHAU_GATEWAY_URL   default https://gateway.musebook.trade/v1
 *   VITE_HAUHAU_MODEL         default clawd/hauhau-uncensored
 *   VITE_HAUHAU_GATEWAY_API_KEY  optional gateway key (mbg_live_…); when unset
 *                             the probe/try-it surface reports the gateway's
 *                             own auth/payment response instead of faking one.
 */
export const HAUHAU_GATEWAY_BASE_URL =
  import.meta.env.VITE_HAUHAU_GATEWAY_URL || 'https://gateway.musebook.trade/v1';

export const HAUHAU_MODEL_ID =
  import.meta.env.VITE_HAUHAU_MODEL || 'clawd/hauhau-uncensored';

export const HAUHAU_GATEWAY_API_KEY =
  import.meta.env.VITE_HAUHAU_GATEWAY_API_KEY || '';

function gatewayHeaders(extra = {}) {
  const headers = { ...extra };
  if (HAUHAU_GATEWAY_API_KEY) {
    headers.Authorization = `Bearer ${HAUHAU_GATEWAY_API_KEY}`;
  }
  return headers;
}

/**
 * Probe the gateway for the Hau Hau model.
 * Returns { live: true } only when /v1/models answers 200 AND lists the model
 * id. Any other outcome returns { live: false, detail } with what actually
 * happened — the UI shows that as the "endpoint not live yet" state.
 */
export async function probeHauhauEndpoint(signal) {
  try {
    const response = await fetch(`${HAUHAU_GATEWAY_BASE_URL}/models`, {
      headers: gatewayHeaders(),
      signal,
    });
    if (!response.ok) {
      return { live: false, detail: `Gateway answered HTTP ${response.status}` };
    }
    const body = await response.json().catch(() => null);
    const ids = (body?.data || []).map((m) => m.id);
    if (ids.includes(HAUHAU_MODEL_ID)) {
      return { live: true, detail: `${HAUHAU_MODEL_ID} is listed on the gateway` };
    }
    return { live: false, detail: `${HAUHAU_MODEL_ID} is not listed on the gateway yet` };
  } catch (error) {
    return { live: false, detail: `Gateway unreachable: ${error.message}` };
  }
}

/**
 * One chat completion against the gateway. Throws with the gateway's own
 * error message on failure — callers must surface it, never substitute a
 * canned answer.
 */
export async function chatHauhau(prompt) {
  const response = await fetch(`${HAUHAU_GATEWAY_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: gatewayHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      model: HAUHAU_MODEL_ID,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 512,
    }),
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body?.error?.message || body?.error || `HTTP ${response.status}`;
    throw new Error(`Gateway: ${message}`);
  }

  const content = body?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Gateway returned no completion content');
  }
  return content;
}

export default { probeHauhauEndpoint, chatHauhau };
