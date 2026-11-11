import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { generateFact } from "./openai";

export const CACHE_WINDOW_MS = 60_000;

export class NoMovieError extends Error {}
export class FactUnavailableError extends Error {}

export type FactResult = {
  fact: { id: string; content: string; movie: string; createdAt: Date };
  cached: boolean; // served from the 60s window (or as a fallback)
  stale: boolean;  // OpenAI failed and we served an older fact
};

export type Deps = {
  generate: (movie: string) => Promise<string>;
  now: () => Date;
};
const defaultDeps: Deps = { generate: generateFact, now: () => new Date() };

type Db = Prisma.TransactionClient;

function latest(db: Db, userId: string, movie: string) {
  return db.fact.findFirst({
    where: { userId, movie },
    orderBy: { createdAt: "desc" },
  });
}

const isFresh = (f: { createdAt: Date }, now: Date) =>
  now.getTime() - f.createdAt.getTime() < CACHE_WINDOW_MS;

/**
 * Authorization: the only identifier passed in is the authenticated user's id
 * (from the session, never from the request), and every query is scoped by it.
 */
export async function getFact(userId: string, deps: Deps = defaultDeps): Promise<FactResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { favoriteMovie: true },
  });
  if (!user?.favoriteMovie) throw new NoMovieError();
  const movie = user.favoriteMovie;

  // Fast path: no lock, no transaction.
  const recent = await latest(prisma, userId, movie);
  if (recent && isFresh(recent, deps.now())) {
    return { fact: recent, cached: true, stale: false };
  }

  try {
    return await prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
        // Burst protection: serialize generation per (user, movie).
        // Concurrent requests wait here; the lock is released when the transaction ends.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${userId}:${movie}`}, 0))`;

        // Re-check after getting the lock: whoever held it before us has
        // probably just created a fresh fact, so we reuse it.
        const again = await latest(tx, userId, movie);
        if (again && isFresh(again, deps.now())) {
          return { fact: again, cached: true, stale: false };
        }

        const content = await deps.generate(movie);
        const created = await tx.fact.create({
          data: { userId, movie, content, createdAt: deps.now() },
        });
        return { fact: created, cached: false, stale: false };
      },
      { maxWait: 10_000, timeout: 20_000 },
    );
  } catch (err) {
    console.error("Fact generation failed:", err);
    // Failure handling: fall back to any previously stored fact for this movie.
    const fallback = await latest(prisma, userId, movie);
    if (fallback) return { fact: fallback, cached: true, stale: true };
    throw new FactUnavailableError("Could not generate a fact right now");
  }
}