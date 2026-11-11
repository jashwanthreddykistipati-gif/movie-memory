import { redirect } from "next/navigation";
import { auth, signIn } from "../auth";

export default async function Landing() {
  const session = await auth();
  if (session?.user) redirect("/dashboard"); // dashboard sends first-timers to onboarding

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold">Movie Memory</h1>
      <p className="text-gray-600">
        Tell us your favorite movie. We&apos;ll tell you something fun about it.
      </p>
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/dashboard" });
        }}
      >
        <button className="rounded-lg bg-black px-5 py-3 text-white hover:bg-gray-800">
          Sign in with Google
        </button>
      </form>
    </main>
  );
}