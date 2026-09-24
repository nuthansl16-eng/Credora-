import { requireAdmin } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createReligion, setReligionApproval, setReligionActive } from "./actions";

export default async function AdminReligionsPage() {
  await requireAdmin();
  const admin = createAdminClient();
  const { data: religions } = await admin.from("religions").select("*").order("created_at", { ascending: false });

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Religions / Communities</h1>

      <details className="mt-6 rounded-lg border p-4">
        <summary className="cursor-pointer text-sm font-medium">+ Add a new community</summary>
        <form action={createReligion} className="mt-4 space-y-3">
          <input name="slug" placeholder="url-slug" required className="w-full rounded-md border px-3 py-2 text-sm" />
          <input name="name" placeholder="Display name" required className="w-full rounded-md border px-3 py-2 text-sm" />
          <input name="shortDescription" placeholder="Short description" className="w-full rounded-md border px-3 py-2 text-sm" />
          <textarea name="description" placeholder="Full neutral description" className="w-full rounded-md border px-3 py-2 text-sm" rows={3} />
          <input name="symbolImageUrl" placeholder="Symbol image URL (approved asset)" className="w-full rounded-md border px-3 py-2 text-sm" />
          <input name="sacredSymbol" placeholder="Traditional/sacred symbol (e.g. ✝, ☪, ॐ, ☸)" className="w-full rounded-md border px-3 py-2 text-sm" />
          <input name="sacredSymbolLabel" placeholder="Symbol label (neutral description)" className="w-full rounded-md border px-3 py-2 text-sm" />
          <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white">
            Create (unapproved by default)
          </button>
        </form>
      </details>

      <table className="mt-6 w-full text-left text-sm">
        <thead className="border-b text-xs uppercase text-muted-foreground">
          <tr>
            <th className="py-2">Name</th>
            <th className="py-2">Slug</th>
            <th className="py-2">Approved</th>
            <th className="py-2">Active</th>
            <th className="py-2">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {(religions ?? []).map((r) => (
            <tr key={r.id}>
              <td className="py-2">{r.name}</td>
              <td className="py-2 font-mono text-xs">{r.slug}</td>
              <td className="py-2">{r.is_approved ? "Yes" : "No"}</td>
              <td className="py-2">{r.is_active ? "Yes" : "No"}</td>
              <td className="py-2">
                <form
                  action={async (formData: FormData) => {
                    "use server";
                    await setReligionApproval(r.id, !r.is_approved, String(formData.get("reason") ?? "Admin dashboard toggle"));
                  }}
                  className="inline"
                >
                  <input type="hidden" name="reason" value="Toggled from admin dashboard" />
                  <button className="mr-2 text-xs font-medium text-primary underline">
                    {r.is_approved ? "Unapprove" : "Approve"}
                  </button>
                </form>
                <form
                  action={async (formData: FormData) => {
                    "use server";
                    await setReligionActive(r.id, !r.is_active, String(formData.get("reason") ?? "Admin dashboard toggle"));
                  }}
                  className="inline"
                >
                  <input type="hidden" name="reason" value="Toggled from admin dashboard" />
                  <button className="text-xs font-medium text-red-600 underline">
                    {r.is_active ? "Deactivate" : "Activate"}
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
