import { requireAdmin } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { setUserSuspension } from "./actions";

export default async function AdminUsersPage({ searchParams }: { searchParams: { q?: string } }) {
  await requireAdmin();
  const admin = createAdminClient();

  let query = admin
    .from("profiles")
    .select("id, username, is_admin, is_suspended, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (searchParams.q) {
    query = query.ilike("username", `%${searchParams.q}%`);
  }
  const { data: users } = await query;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Users</h1>
      <p className="mt-1 text-xs text-muted-foreground">
        Emails and payment details are never shown here — only what's needed for moderation.
      </p>

      <form action="/admin/users" className="mt-4 flex gap-2">
        <input name="q" defaultValue={searchParams.q} placeholder="Search by username…" className="w-full rounded-md border px-3 py-2 text-sm" />
        <button className="rounded-md border px-4 py-2 text-sm">Search</button>
      </form>

      <table className="mt-6 w-full text-left text-sm">
        <thead className="border-b text-xs uppercase text-muted-foreground">
          <tr>
            <th className="py-2">Username</th>
            <th className="py-2">Admin</th>
            <th className="py-2">Suspended</th>
            <th className="py-2">Joined</th>
            <th className="py-2">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {(users ?? []).map((u) => (
            <tr key={u.id}>
              <td className="py-2">{u.username ?? <span className="text-muted-foreground">(not set)</span>}</td>
              <td className="py-2">{u.is_admin ? "Yes" : "No"}</td>
              <td className="py-2">{u.is_suspended ? "Yes" : "No"}</td>
              <td className="py-2">{new Date(u.created_at).toLocaleDateString()}</td>
              <td className="py-2">
                <form
                  action={async (formData: FormData) => {
                    "use server";
                    await setUserSuspension(
                      u.id,
                      !u.is_suspended,
                      String(formData.get("reason") ?? "Toggled from admin dashboard")
                    );
                  }}
                >
                  <input type="hidden" name="reason" value="Toggled from admin dashboard" />
                  <button className={`text-xs font-medium underline ${u.is_suspended ? "text-green-700" : "text-red-600"}`}>
                    {u.is_suspended ? "Unsuspend" : "Suspend"}
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
