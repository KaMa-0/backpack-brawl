import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchHallOfFame, fetchOpponent, HALL_ERRORS, parseOpponent, SEARCH_ERRORS, submitHallRun, unreachableWithStatus } from "./api";

const VALID = { id: "mossback-hermit", name: "Mossback Hermit", icon: "🐢", hp: 25, items: ["chipped-dagger", "pot-lid"], round: 1 };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** Replaces `fetch` with a mock and returns it, so calls can be inspected. */
function mockFetch(implementation: (url: string, init?: RequestInit) => Promise<Response>) {
  const fetchMock = vi.fn(implementation);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("fetchOpponent", () => {
  it("returns a valid opponent", async () => {
    mockFetch(async () => json(VALID));
    await expect(fetchOpponent(1, { testQuery: "" })).resolves.toEqual(VALID);
  });

  it("asks for the round and passes only the fail/latency test switches on", async () => {
    const fetchMock = mockFetch(async () => json(VALID));
    await fetchOpponent(3, { testQuery: "?fail=true&latency=5000&other=x" });

    const url = new URL(fetchMock.mock.calls[0][0], "http://localhost");
    expect(url.pathname).toBe("/api/opponents");
    expect(Object.fromEntries(url.searchParams)).toEqual({ round: "3", fail: "true", latency: "5000" });
  });

  it("shows the server's own error text", async () => {
    mockFetch(async () => json({ error: "The arena gates are shut. No challenger answered the call." }, 503));
    await expect(fetchOpponent(1, { testQuery: "" })).rejects.toThrow("The arena gates are shut.");
  });

  it("explains an error without a readable body, e.g. from the dev proxy when the API is down", async () => {
    mockFetch(async () => new Response("Internal Server Error", { status: 500 }));
    await expect(fetchOpponent(1, { testQuery: "" })).rejects.toThrow(unreachableWithStatus(500));
    expect(unreachableWithStatus(500)).toBe("The arena server can't be reached right now (error 500).");
  });

  it("explains a server that can't be reached", async () => {
    mockFetch(async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(fetchOpponent(1, { testQuery: "" })).rejects.toThrow(SEARCH_ERRORS.unreachable);
  });

  it("gives up when the answer takes longer than the timeout", async () => {
    vi.useFakeTimers();
    mockFetch(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        }),
    );

    const result = expect(fetchOpponent(1, { timeoutMs: 8000, testQuery: "" })).rejects.toThrow(SEARCH_ERRORS.timeout);
    await vi.advanceTimersByTimeAsync(8000);
    await result;
  });

  it("rejects an answer the game can't use instead of crashing later", async () => {
    mockFetch(async () => json({ ...VALID, items: ["chipped-dagger", "laser-sword"] }));
    await expect(fetchOpponent(1, { testQuery: "" })).rejects.toThrow(SEARCH_ERRORS.invalid);

    mockFetch(async () => new Response("not json", { status: 200 }));
    await expect(fetchOpponent(1, { testQuery: "" })).rejects.toThrow(SEARCH_ERRORS.invalid);
  });
});

describe("parseOpponent", () => {
  it("accepts the documented shape", () => {
    expect(parseOpponent(VALID)).toEqual(VALID);
  });

  it("rejects missing fields, bad numbers, unknown items and too many items", () => {
    expect(parseOpponent(null)).toBeNull();
    expect(parseOpponent({ ...VALID, name: undefined })).toBeNull();
    expect(parseOpponent({ ...VALID, hp: 0 })).toBeNull();
    expect(parseOpponent({ ...VALID, round: 1.5 })).toBeNull();
    expect(parseOpponent({ ...VALID, items: ["unknown-item"] })).toBeNull();
    expect(parseOpponent({ ...VALID, items: Array(7).fill("pot-lid") })).toBeNull();
  });
});

describe("hall of fame requests", () => {
  const entry = { rank: 1, runId: "run_abcdefgh", name: "Ada", wins: 5, lives: 1, rounds: 7, victory: true, submittedAt: 1 };

  it("loads the entries and submits a run", async () => {
    mockFetch(async () => json({ entries: [entry] }));
    await expect(fetchHallOfFame()).resolves.toEqual([entry]);

    const fetchMock = mockFetch(async () => json({ entry, duplicate: false }, 201));
    await expect(submitHallRun({ runId: "run_abcdefgh", name: "Ada", wins: 5, lives: 1, rounds: 7 })).resolves.toEqual({ entry, duplicate: false });
    expect(fetchMock.mock.calls[0][1]?.method).toBe("POST");
  });

  it("shows the server's validation error", async () => {
    mockFetch(async () => json({ error: "Name must be 2–24 characters." }, 400));
    await expect(submitHallRun({ runId: "run_abcdefgh", name: "A", wins: 5, lives: 1, rounds: 7 })).rejects.toThrow("Name must be 2–24 characters.");
  });

  it("explains an unreachable server instead of showing 'Failed to fetch'", async () => {
    mockFetch(async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(fetchHallOfFame()).rejects.toThrow(HALL_ERRORS.unreachable);
  });
});

