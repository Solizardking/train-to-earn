import { test } from "node:test";
import assert from "node:assert/strict";

import { ApiClient, ApiError } from "../lib/api.js";

function mockFetch(handler) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    const { status = 200, json = {} } = handler(url, init);
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? "OK" : "Error",
      text: async () => (typeof json === "string" ? json : JSON.stringify(json)),
    };
  };
  fn.calls = calls;
  return fn;
}

test("GET parses JSON and builds the URL from the base", async () => {
  const fetchImpl = mockFetch(() => ({ json: { status: "ok" } }));
  const api = new ApiClient({ base: "https://api.example.test/", fetchImpl });
  const res = await api.health();
  assert.equal(res.status, "ok");
  assert.equal(fetchImpl.calls[0].url, "https://api.example.test/api/health");
  assert.equal(fetchImpl.calls[0].init.method, "GET");
});

test("POST sends a JSON body with content-type", async () => {
  const fetchImpl = mockFetch(() => ({ json: { nonce: "n1" } }));
  const api = new ApiClient({ base: "https://api.example.test", fetchImpl });
  await api.authChallenge("WALLET");
  const { init } = fetchImpl.calls[0];
  assert.equal(init.headers["content-type"], "application/json");
  assert.deepEqual(JSON.parse(init.body), { wallet: "WALLET" });
});

test("auth requests carry the bearer token; unauthenticated auth calls fail fast", async () => {
  const fetchImpl = mockFetch(() => ({ json: { wallet: "W" } }));
  const api = new ApiClient({ base: "https://api.example.test", token: "tok123", fetchImpl });
  await api.authMe();
  assert.equal(fetchImpl.calls[0].init.headers.authorization, "Bearer tok123");

  const anon = new ApiClient({ base: "https://api.example.test", fetchImpl: mockFetch(() => ({ json: {} })) });
  await assert.rejects(() => anon.authMe(), /not logged in/);
});

test("non-2xx becomes an ApiError with status and server detail", async () => {
  const fetchImpl = mockFetch(() => ({ status: 503, json: { error: "Database unavailable" } }));
  const api = new ApiClient({ base: "https://api.example.test", fetchImpl });
  await assert.rejects(
    () => api.rewardsBalance("WALLET"),
    (err) => err instanceof ApiError && err.status === 503 && /Database unavailable/.test(err.message),
  );
});

test("network failure becomes an ApiError without a status", async () => {
  const api = new ApiClient({
    base: "https://api.example.test",
    fetchImpl: async () => {
      throw new Error("socket hang up");
    },
  });
  await assert.rejects(
    () => api.health(),
    (err) => err instanceof ApiError && err.status === null && /network error/.test(err.message),
  );
});
