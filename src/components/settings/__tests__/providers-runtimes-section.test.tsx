import { render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProvidersAndRuntimesSection } from "@/components/settings/providers-runtimes-section";

describe("providers and runtimes section", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("open", vi.fn());
    Element.prototype.scrollIntoView = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";

        if (url === "/api/settings/providers" && method === "GET") {
          return {
            ok: true,
            json: async () => ({
              providers: {
                anthropic: {
                  configured: false,
                  authMethod: "api_key",
                  hasKey: false,
                  apiKeySource: "unknown",
                  dualBilling: false,
                  runtimes: [
                    {
                      runtimeId: "claude-code",
                      label: "Claude Code",
                      providerId: "anthropic",
                      configured: false,
                      authMethod: "none",
                      apiKeySource: "unknown",
                      billingMode: "usage",
                    },
                    {
                      runtimeId: "anthropic-direct",
                      label: "Anthropic Direct API",
                      providerId: "anthropic",
                      configured: false,
                      authMethod: "none",
                      apiKeySource: "unknown",
                      billingMode: "usage",
                    },
                  ],
                },
                openai: {
                  configured: true,
                  authMethod: "oauth",
                  hasKey: true,
                  apiKeySource: "env",
                  oauthConnected: false,
                  account: null,
                  rateLimits: null,
                  login: {
                    phase: "idle",
                    loginId: null,
                    authUrl: null,
                    account: null,
                    rateLimits: null,
                    error: null,
                    startedAt: null,
                    updatedAt: new Date("2026-04-10T15:00:00.000Z").toISOString(),
                  },
                  dualBilling: false,
                  runtimes: [
                    {
                      runtimeId: "openai-codex-app-server",
                      label: "OpenAI Codex App Server",
                      providerId: "openai",
                      configured: false,
                      authMethod: "oauth",
                      apiKeySource: "oauth",
                      billingMode: "usage",
                    },
                    {
                      runtimeId: "openai-direct",
                      label: "OpenAI Direct API",
                      providerId: "openai",
                      configured: true,
                      authMethod: "api_key",
                      apiKeySource: "env",
                      billingMode: "usage",
                    },
                  ],
                },
              },
              routingPreference: "quality",
              configuredProviderCount: 1,
            }),
          };
        }

        if (url === "/api/settings/openai/login" && method === "POST") {
          return {
            ok: true,
            json: async () => ({
              phase: "pending",
              loginId: "login-1",
              authUrl: "https://auth.openai.com/log-in",
              account: null,
              rateLimits: null,
              error: null,
              startedAt: new Date("2026-04-10T15:01:00.000Z").toISOString(),
              updatedAt: new Date("2026-04-10T15:01:00.000Z").toISOString(),
            }),
          };
        }

        throw new Error(`Unexpected fetch: ${url}`);
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows partial OpenAI setup state when ChatGPT auth is selected but not connected", async () => {
    render(<ProvidersAndRuntimesSection />);

    await waitFor(() => {
      expect(screen.getByText("Direct API only")).toBeInTheDocument();
    });

    expect(
      screen.getByText("Codex App Server needs ChatGPT sign-in. OpenAI Direct API remains active.")
    ).toBeInTheDocument();
    expect(screen.getAllByText("Sign in with ChatGPT")).toHaveLength(2);
  });

  it("updates the provider row immediately when ChatGPT sign-in starts", async () => {
    render(<ProvidersAndRuntimesSection />);

    const signInButton = await screen.findByRole("button", {
      name: "Sign in with ChatGPT",
    });
    signInButton.click();

    await waitFor(() => {
      expect(
        screen.getByText("Waiting for ChatGPT sign-in. OpenAI Direct API remains active.")
      ).toBeInTheDocument();
    });

    expect(screen.getAllByText("Waiting for ChatGPT sign-in")).toHaveLength(2);
  });

  it("shows an error card with retry (not an endless spinner) when the fetch is non-OK (issue #9)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })),
    );

    render(<ProvidersAndRuntimesSection />);

    // The loading state must clear and surface a visible failure with a retry —
    // the old `loading || !data` guard hung on "Loading provider configuration".
    const retry = await screen.findByRole("button", { name: "Retry" });
    expect(retry).toBeInTheDocument();
    expect(
      screen.getByText(/Failed to load provider configuration \(HTTP 500\)/),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Loading provider configuration..."),
    ).not.toBeInTheDocument();
  });
});

// ── Cascade-specific tests ─────────────────────────────────────────

interface CascadeFixtureOpts {
  preference?: "latency" | "cost" | "quality" | "manual";
  ollamaConnected?: boolean;
  anthropicMethod?: "api_key" | "oauth";
  anthropicModel?: string | null;
  openaiMethod?: "api_key" | "oauth";
  openaiModel?: string | null;
  chatDefaultModel?: string | null;
  anthropicPOST?: () => { ok: boolean; json?: () => Promise<unknown> };
  openaiPOST?: () => { ok: boolean; json?: () => Promise<unknown> };
  ollamaPOST?: () => { ok: boolean; json?: () => Promise<unknown> };
  chatPUT?: () => { ok: boolean; json?: () => Promise<unknown> };
}

function buildProvidersPayload(opts: CascadeFixtureOpts) {
  return {
    providers: {
      anthropic: {
        configured: true,
        authMethod: opts.anthropicMethod ?? "api_key",
        hasKey: true,
        apiKeySource: "db",
        dualBilling: false,
        directModel: opts.anthropicModel ?? null,
        runtimes: [
          {
            runtimeId: "claude-code",
            label: "Claude Code",
            providerId: "anthropic",
            configured: true,
            authMethod: "api_key",
            apiKeySource: "db",
            billingMode: "usage",
          },
          {
            runtimeId: "anthropic-direct",
            label: "Anthropic Direct API",
            providerId: "anthropic",
            configured: true,
            authMethod: "api_key",
            apiKeySource: "db",
            billingMode: "usage",
          },
        ],
      },
      openai: {
        configured: true,
        authMethod: opts.openaiMethod ?? "api_key",
        hasKey: true,
        apiKeySource: "db",
        oauthConnected: true,
        account: null,
        rateLimits: null,
        login: {
          phase: "idle",
          loginId: null,
          authUrl: null,
          account: null,
          rateLimits: null,
          error: null,
          startedAt: null,
          updatedAt: new Date("2026-04-10T15:00:00.000Z").toISOString(),
        },
        dualBilling: false,
        directModel: opts.openaiModel ?? null,
        runtimes: [
          {
            runtimeId: "openai-codex-app-server",
            label: "OpenAI Codex App Server",
            providerId: "openai",
            configured: true,
            authMethod: "oauth",
            apiKeySource: "oauth",
            billingMode: "usage",
          },
          {
            runtimeId: "openai-direct",
            label: "OpenAI Direct API",
            providerId: "openai",
            configured: true,
            authMethod: "api_key",
            apiKeySource: "db",
            billingMode: "usage",
          },
        ],
      },
    },
    ollama: {
      configured: true,
      connected: opts.ollamaConnected ?? false,
      baseUrl: "http://localhost:11434",
      defaultModel: "llama3",
    },
    chatDefaultModel: opts.chatDefaultModel ?? null,
    routingPreference: opts.preference ?? "manual",
    configuredProviderCount: 2,
  };
}

function stubCascadeFetch(opts: CascadeFixtureOpts) {
  const calls: Array<{ url: string; method: string; body?: unknown }> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url, method, body });

      if (url === "/api/settings/providers" && method === "GET") {
        return { ok: true, json: async () => buildProvidersPayload(opts) };
      }
      if (url === "/api/settings/routing" && method === "POST") {
        return { ok: true, json: async () => ({ preference: body?.preference }) };
      }
      if (url === "/api/settings" && method === "POST") {
        return opts.anthropicPOST?.() ?? { ok: true, json: async () => ({}) };
      }
      if (url === "/api/settings/openai" && method === "POST") {
        return opts.openaiPOST?.() ?? { ok: true, json: async () => ({}) };
      }
      if (url === "/api/settings/ollama" && method === "POST") {
        return opts.ollamaPOST?.() ?? { ok: true, json: async () => ({}) };
      }
      if (url === "/api/settings/chat" && method === "PUT") {
        return opts.chatPUT?.() ?? { ok: true, json: async () => ({}) };
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    }),
  );
  return calls;
}

describe("routing cascade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("Latency → POSTs auth + model to BOTH providers + PUTs chat default, no Ollama", async () => {
    const calls = stubCascadeFetch({
      preference: "manual",
      anthropicMethod: "oauth",
      anthropicModel: null,
      openaiMethod: "oauth",
      openaiModel: null,
      chatDefaultModel: null,
    });
    render(<ProvidersAndRuntimesSection />);

    const latency = await screen.findByText("Latency");
    latency.click();

    await waitFor(() => {
      const anthPost = calls.find((c) => c.url === "/api/settings" && c.method === "POST");
      const openaiPost = calls.find((c) => c.url === "/api/settings/openai" && c.method === "POST");
      const chatPut = calls.find((c) => c.url === "/api/settings/chat" && c.method === "PUT");
      // Assert that auth + model were sent — NOT the specific ID strings so the
      // tests stay green as the catalog rotates.
      expect(anthPost?.body).toMatchObject({ method: "api_key" });
      expect((anthPost?.body as { model?: string })?.model).toBeTruthy();
      expect(openaiPost?.body).toMatchObject({ method: "api_key" });
      expect((openaiPost?.body as { model?: string })?.model).toBeTruthy();
      expect((chatPut?.body as { defaultModel?: string })?.defaultModel).toBeTruthy();
    });

    const ollamaPost = calls.find((c) => c.url === "/api/settings/ollama" && c.method === "POST");
    expect(ollamaPost).toBeUndefined();
  });

  it("Cost with Ollama connected → cloud fallbacks fire, Ollama skipped when already on catalog default", async () => {
    const calls = stubCascadeFetch({
      preference: "manual",
      ollamaConnected: true,
      anthropicMethod: "oauth",
      openaiMethod: "oauth",
    });
    render(<ProvidersAndRuntimesSection />);

    const cost = await screen.findByText("Cost");
    cost.click();

    await waitFor(() => {
      const ollamaPost = calls.find((c) => c.url === "/api/settings/ollama" && c.method === "POST");
      // defaultModel "llama3" matches current → skipped; but recommendation.useOllama=true
      // still fires auth+model for both cloud providers
      expect(ollamaPost).toBeUndefined();
      const anthPost = calls.find((c) => c.url === "/api/settings" && c.method === "POST");
      expect((anthPost?.body as { model?: string })?.model).toBeTruthy();
    });
  });

  it("Cost with Ollama offline → no Ollama POST, no Ollama banner row", async () => {
    const calls = stubCascadeFetch({
      preference: "cost",
      ollamaConnected: false,
    });
    render(<ProvidersAndRuntimesSection />);

    await waitFor(() => {
      expect(screen.getByTestId("routing-recommendation")).toBeInTheDocument();
    });
    const banner = screen.getByTestId("routing-recommendation");
    expect(within(banner).queryByText("Ollama")).not.toBeInTheDocument();
    const ollamaPost = calls.find((c) => c.url === "/api/settings/ollama" && c.method === "POST");
    expect(ollamaPost).toBeUndefined();
  });

  it("Manual → no provider POSTs fire, banner collapses to explanatory line", async () => {
    const calls = stubCascadeFetch({
      preference: "cost",
      anthropicMethod: "api_key",
      openaiMethod: "api_key",
    });
    render(<ProvidersAndRuntimesSection />);

    const manual = await screen.findByText("Manual");
    manual.click();

    await waitFor(() => {
      const routingPost = calls.find((c) => c.url === "/api/settings/routing" && c.method === "POST");
      expect(routingPost?.body).toEqual({ preference: "manual" });
    });

    const anthPost = calls.find((c) => c.url === "/api/settings" && c.method === "POST");
    const openaiPost = calls.find((c) => c.url === "/api/settings/openai" && c.method === "POST");
    expect(anthPost).toBeUndefined();
    expect(openaiPost).toBeUndefined();

    await waitFor(() => {
      expect(screen.getByText(/Manual routing/)).toBeInTheDocument();
    });
  });

  it("Partial cascade failure — openai POST rejects, anthropic still succeeds, UI re-syncs", async () => {
    const calls = stubCascadeFetch({
      preference: "manual",
      anthropicMethod: "oauth", // force a method diff so anthropic POST fires
      openaiMethod: "oauth",
      openaiPOST: () => ({ ok: false, json: async () => ({ error: "boom" }) }),
    });
    render(<ProvidersAndRuntimesSection />);

    const latency = await screen.findByText("Latency");
    latency.click();

    await waitFor(() => {
      const fetchCount = calls.filter((c) => c.url === "/api/settings/providers").length;
      // Initial mount + post-cascade re-sync
      expect(fetchCount).toBeGreaterThanOrEqual(2);
    });
    const anthPost = calls.find((c) => c.url === "/api/settings" && c.method === "POST");
    expect((anthPost?.body as { method?: string })?.method).toBe("api_key");
  });

  it("User already matches recommendation — toast success, no provider or chat POSTs", async () => {
    const { getRuntimeCatalogEntry } = await import("@/lib/agents/runtime/catalog");
    const { CHAT_MODELS } = await import("@/lib/chat/types");
    const anthModel = getRuntimeCatalogEntry("anthropic-direct").models.tiers?.fast;
    const openaiModel = getRuntimeCatalogEntry("openai-direct").models.tiers?.fast;
    const chatModel = CHAT_MODELS.find((m) => m.provider === "anthropic" && m.tier === "Fast")?.id;

    const calls = stubCascadeFetch({
      preference: "manual",
      anthropicMethod: "api_key",
      anthropicModel: anthModel,
      openaiMethod: "api_key",
      openaiModel,
      chatDefaultModel: chatModel,
    });
    render(<ProvidersAndRuntimesSection />);

    const latency = await screen.findByText("Latency");
    latency.click();

    await waitFor(() => {
      const routingPost = calls.find((c) => c.url === "/api/settings/routing" && c.method === "POST");
      expect(routingPost).toBeDefined();
    });
    const anthPost = calls.find((c) => c.url === "/api/settings" && c.method === "POST");
    const openaiPost = calls.find((c) => c.url === "/api/settings/openai" && c.method === "POST");
    const chatPut = calls.find((c) => c.url === "/api/settings/chat" && c.method === "PUT");
    expect(anthPost).toBeUndefined();
    expect(openaiPost).toBeUndefined();
    expect(chatPut).toBeUndefined();
  });
});
