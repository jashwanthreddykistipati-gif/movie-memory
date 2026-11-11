"use client";
import { useActionState } from "react";
import { saveMovie } from "../app/onboarding/actions";

export default function OnboardingForm() {
  const [state, action, pending] = useActionState(saveMovie, {} as { error?: string });
  return (
    <form action={action} className="flex w-full max-w-sm flex-col gap-3">
      <input
        name="movie"
        placeholder="e.g. The Princess Bride"
        maxLength={100}
        required
        className="rounded border p-3"
      />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button disabled={pending} className="rounded bg-black p-3 text-white disabled:opacity-50">
        {pending ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}