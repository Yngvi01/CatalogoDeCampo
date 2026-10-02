/** Explicit operator action: never runs during login or application startup. */
import { loadEnvFile } from "node:process";
import postgres from "postgres";
import { z } from "zod";
for (const file of [".env.local", ".env"]) try { loadEnvFile(file); } catch {}
const userId = z.uuid().parse(process.argv.find(arg => arg.startsWith("--user="))?.slice(7));
if (process.env.CAMPO_AUTH !== "supabase" || !process.env.DATABASE_URL) throw new Error("Configure CAMPO_AUTH=supabase e DATABASE_URL antes de atribuir o catálogo anterior.");
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1, ssl: "require" });
try {
  await sql.begin(async tx => {
    const org = "00000000-0000-0000-0000-000000000001";
    const [user] = await tx`SELECT id,email FROM auth.users WHERE id=${userId} AND email_confirmed_at IS NOT NULL`;
    if (!user) throw new Error("Conta não encontrada ou e-mail ainda não confirmado.");
    await tx`SELECT id FROM public.organizations WHERE id=${org} FOR UPDATE`;
    const owners = await tx`SELECT user_id FROM public.organization_members WHERE organization_id=${org} AND role='owner'`;
    if (owners.length && !owners.some(owner => owner.user_id === userId)) throw new Error("O catálogo anterior já tem proprietário. Gerencie a equipe pela aplicação.");
    await tx`INSERT INTO public.organization_members(organization_id,user_id,role) VALUES(${org},${userId},'owner') ON CONFLICT(organization_id,user_id) DO UPDATE SET role='owner'`;
    console.log(`Catálogo anterior atribuído à conta confirmada ${user.email}.`);
  });
} finally { await sql.end(); }
