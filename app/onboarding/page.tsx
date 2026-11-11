import { redirect } from "next/navigation";
import { auth } from "../../auth";
import { prisma } from "../../lib/prisma";
import OnboardingForm from "../../components/OnboardingForm";

export default async function Onboarding() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (user?.favoriteMovie) redirect("/dashboard");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">What&apos;s your favorite movie?</h1>
      <OnboardingForm />
    </main>
  );
}