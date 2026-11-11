import { NextResponse } from "next/server";
import { auth } from "../../../auth";
import { getFact, NoMovieError, FactUnavailableError } from "../../../lib/facts";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    // No userId or query params are read: a user can only ever get their own facts.
    const { fact, cached, stale } = await getFact(session.user.id);
    return NextResponse.json({
      fact: { content: fact.content, movie: fact.movie, createdAt: fact.createdAt },
      cached,
      stale,
    });
  } catch (e) {
    if (e instanceof NoMovieError) {
      return NextResponse.json({ error: "Set a favorite movie first" }, { status: 409 });
    }
    if (e instanceof FactUnavailableError) {
      return NextResponse.json(
        { error: "We couldn't fetch a fun fact right now. Please try again shortly." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}