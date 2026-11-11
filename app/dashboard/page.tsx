import { redirect } from "next/navigation";
import { auth, signOut } from "../../auth";
import { prisma } from "../../lib/prisma";
import FactCard from "../../components/FactCard";

export default async function Dashboard() {
  const session = await auth();
  if (!session?.user?.id) redirect("/"); // not logged in => back to the landing/login page

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/");
  if (!user.favoriteMovie) redirect("/onboarding");

  const displayName = user.name ?? "Movie fan";
  const initial = displayName[0]?.toUpperCase() ?? "?";

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 p-8">
      <div className="flex items-center gap-4">
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.image}
            alt=""
            referrerPolicy="no-referrer"
            className="h-16 w-16 rounded-full"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-200 text-xl">
            {initial}
          </div>
        )}
        <div>
          <p className="text-lg font-semibold">{displayName}</p>
          <p className="text-gray-600">{user.email ?? "No email on file"}</p>
        </div>
      </div>

      <section>
        <h2 className="text-sm uppercase text-gray-500">Favorite movie</h2>
        <p className="text-2xl font-semibold">{user.favoriteMovie}</p>
      </section>

      <section>
        <h2 className="text-sm uppercase text-gray-500">Fun fact</h2>
        <FactCard />
      </section>

      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <button className="rounded border px-4 py-2 hover:bg-gray-100">Log out</button>
      </form>
    </main>
  );
}