"use server";
import { redirect } from "next/navigation";
import { auth } from "../../auth";
import { prisma } from "../../lib/prisma";
import { movieSchema } from "../../lib/validation";

export async function saveMovie(_prev: { error?: string }, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const parsed = movieSchema.safeParse(formData.get("movie"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // The id comes from the session, never from the form, so users can only edit themselves.
  await prisma.user.update({
    where: { id: session.user.id },
    data: { favoriteMovie: parsed.data },
  });
  redirect("/dashboard");
}