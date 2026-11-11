import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { prisma } from "../lib/prisma";
import { getFact, FactUnavailableError, CACHE_WINDOW_MS } from "../lib/facts";

const mkUser = (email: string, movie = "Heat") =>
  prisma.user.create({ data: { email, favoriteMovie: movie } });
const mkFact = (userId: string, movie: string, ageMs: number, content = "old fact") =>
  prisma.fact.create({
    data: { userId, movie, content, createdAt: new Date(Date.now() - ageMs) },
  });
const deps = (generate: (m: string) => Promise<string>) => ({
  generate,
  now: () => new Date(),
});

// Only deletes throwaway test users (facts cascade), never real data.
beforeEach(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: "@test.local" } } });
});
afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: "@test.local" } } });
  await prisma.$disconnect();
});

describe("60-second cache window", () => {
  it("returns the cached fact when it is < 60s old", async () => {
    const u = await mkUser("a@test.local");
    await mkFact(u.id, "Heat", 10_000, "cached!");
    const gen = vi.fn().mockResolvedValue("new");
    const r = await getFact(u.id, deps(gen));
    expect(r.fact.content).toBe("cached!");
    expect(r.cached).toBe(true);
    expect(gen).not.toHaveBeenCalled();
  });

  it("generates and stores a new fact when the latest is > 60s old", async () => {
    const u = await mkUser("b@test.local");
    await mkFact(u.id, "Heat", CACHE_WINDOW_MS + 1_000);
    const gen = vi.fn().mockResolvedValue("brand new");
    const r = await getFact(u.id, deps(gen));
    expect(r.fact.content).toBe("brand new");
    expect(r.cached).toBe(false);
    expect(await prisma.fact.count({ where: { userId: u.id } })).toBe(2);
  });

  it("does not reuse a fresh fact about a different movie", async () => {
    const u = await mkUser("c@test.local", "Heat");
    await mkFact(u.id, "Alien", 1_000);
    const gen = vi.fn().mockResolvedValue("heat fact");
    const r = await getFact(u.id, deps(gen));
    expect(r.fact.movie).toBe("Heat");
    expect(gen).toHaveBeenCalledTimes(1);
  });
});

describe("burst protection", () => {
  it("generates only once for concurrent requests", async () => {
    const u = await mkUser("d@test.local");
    const gen = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 300));
      return "only one";
    });
    const results = await Promise.all(
      Array.from({ length: 5 }, () => getFact(u.id, deps(gen))),
    );
    expect(gen).toHaveBeenCalledTimes(1);
    expect(await prisma.fact.count({ where: { userId: u.id } })).toBe(1);
    expect(new Set(results.map((r) => r.fact.id)).size).toBe(1);
  });
});

describe("failure handling", () => {
  it("falls back to the latest stored fact if OpenAI fails", async () => {
    const u = await mkUser("e@test.local");
    await mkFact(u.id, "Heat", CACHE_WINDOW_MS * 5, "stale one");
    const r = await getFact(u.id, deps(() => Promise.reject(new Error("timeout"))));
    expect(r.fact.content).toBe("stale one");
    expect(r.stale).toBe(true);
  });

  it("throws a user-facing error if OpenAI fails and nothing is cached", async () => {
    const u = await mkUser("f@test.local");
    await expect(
      getFact(u.id, deps(() => Promise.reject(new Error("boom")))),
    ).rejects.toBeInstanceOf(FactUnavailableError);
  });
});

describe("authorization", () => {
  it("never returns another user's facts", async () => {
    const a = await mkUser("g@test.local", "Heat");
    const b = await mkUser("h@test.local", "Heat"); // same movie on purpose
    await mkFact(b.id, "Heat", 1_000, "B's secret fact");
    const gen = vi.fn().mockResolvedValue("A's own fact");
    const r = await getFact(a.id, deps(gen));
    expect(r.fact.content).toBe("A's own fact");
  });
});

describe("GET /api/fact", () => {
  it("returns 401 with no session", async () => {
    vi.resetModules();
    vi.doMock("../auth", () => ({ auth: async () => null }));
    const { GET } = await import("../app/api/fact/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });
});