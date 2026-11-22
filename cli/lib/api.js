/**
 * api.js — minimal TrainToEarn backend client.
 *
 * Wraps global fetch (Node ≥ 18). Every method returns parsed JSON and
 * throws ApiError (with .status) on a non-2xx response or network failure,
 * so the CLI can print one clean error line and exit non-zero.
 */

export const DEFAULT_API_BASE = "https://traintoearn-backend-y6co.onrender.com";

export class ApiError extends Error {
  constructor(message, { status = null, body = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export class ApiClient {
  /**
   * @param {object} opts
   * @param {string} [opts.base]   API base URL (no trailing slash needed)
   * @param {string} [opts.token]  Bearer token from the session, if logged in
   * @param {Function} [opts.fetchImpl]  fetch implementation (tests inject a mock)
   */
  constructor({ base = DEFAULT_API_BASE, token = null, fetchImpl = globalThis.fetch } = {}) {
    if (typeof fetchImpl !== "function") {
      throw new Error("global fetch is unavailable — Node >= 18 is required");
    }
    this.base = String(base).replace(/\/$/, "");
    this.token = token;
    this.fetch = fetchImpl;
  }

  async request(method, pathname, { body, headers = {}, auth = false } = {}) {
    const finalHeaders = { ...headers };
    if (auth) {
      if (!this.token) {
        throw new ApiError("not logged in — run `traintoearn login` first", { status: 401 });
      }
      finalHeaders.authorization = `Bearer ${this.token}`;
    }
    let payload;
    if (body !== undefined) {
      if (body instanceof FormData) {
        payload = body; // fetch sets the multipart content-type itself
      } else {
        finalHeaders["content-type"] = "application/json";
        payload = JSON.stringify(body);
      }
    }

    let res;
    try {
      res = await this.fetch(this.base + pathname, { method, headers: finalHeaders, body: payload });
    } catch (err) {
      throw new ApiError(`network error calling ${method} ${pathname}: ${err.message}`);
    }

    const text = await res.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }
    }
    if (!res.ok) {
      const detail = data?.error || data?.details || data?.message || res.statusText;
      throw new ApiError(`API ${method} ${pathname} failed (${res.status}): ${detail}`, {
        status: res.status,
        body: data,
      });
    }
    return data;
  }

  get(pathname, opts) {
    return this.request("GET", pathname, opts);
  }

  post(pathname, body, opts = {}) {
    return this.request("POST", pathname, { ...opts, body });
  }

  // ---- Endpoint helpers -----------------------------------------------------

  health() {
    return this.get("/api/health");
  }

  jevStatus() {
    return this.get("/api/jev/status");
  }

  authChallenge(wallet) {
    return this.post("/api/auth/challenge", { wallet });
  }

  authVerify(wallet, signatureBase64) {
    return this.post("/api/auth/verify", { wallet, signature: signatureBase64 });
  }

  authMe() {
    return this.get("/api/auth/me", { auth: true });
  }

  rateText(body) {
    return this.post("/api/jev/rate", body);
  }

  rateMedia(body) {
    return this.post("/api/jev/rate-media", body);
  }

  rateDataset(body) {
    return this.post("/api/jev/rate-dataset", body);
  }

  jevJob(jobId) {
    return this.get(`/api/jev/jobs/${encodeURIComponent(jobId)}`);
  }

  uploadJson(body) {
    return this.post("/api/uploads", body, { auth: true });
  }

  uploadForm(formData) {
    return this.post("/api/uploads", formData, { auth: true });
  }

  uploadsMine() {
    return this.get("/api/uploads/mine", { auth: true });
  }

  registryModels() {
    return this.get("/api/registry/models");
  }

  registryModel(sha256) {
    return this.get(`/api/registry/models/${encodeURIComponent(sha256)}`);
  }

  registryRegister(body) {
    return this.post("/api/registry/register", body);
  }

  modelsList() {
    return this.get("/api/models/list");
  }

  submissionsStats() {
    return this.get("/api/submissions/stats");
  }

  submissionsRecent(limit) {
    return this.get(`/api/submissions/recent${limit ? `?limit=${encodeURIComponent(limit)}` : ""}`);
  }

  submissionsTop(limit) {
    return this.get(`/api/submissions/top${limit ? `?limit=${encodeURIComponent(limit)}` : ""}`);
  }

  rewardsBalance(wallet) {
    return this.get(`/api/rewards/balance/${encodeURIComponent(wallet)}`);
  }

  rewardsTreasury() {
    return this.get("/api/rewards/treasury");
  }
}
