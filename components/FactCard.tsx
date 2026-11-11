"use client";
import { useEffect, useState } from "react";

type State =
  | { status: "loading" }
  | { status: "ok"; content: string; stale: boolean }
  | { status: "error"; message: string };

export default function FactCard() {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/fact")
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? "Something went wrong");
        if (!cancelled) setState({ status: "ok", content: body.fact.content, stale: body.stale });
      })
      .catch((e: Error) => {
        if (!cancelled) setState({ status: "error", message: e.message });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") return <p className="text-gray-500">Finding a fun fact…</p>;
  if (state.status === "error") return <p className="text-red-600">{state.message}</p>;
  return (
    <div>
      <p>{state.content}</p>
      {state.stale && (
        <p className="mt-1 text-xs text-gray-500">
          Showing a previous fact; we couldn&apos;t fetch a new one.
        </p>
      )}
    </div>
  );
}