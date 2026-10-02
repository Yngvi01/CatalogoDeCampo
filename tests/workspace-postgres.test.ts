import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import postgres from "postgres";

test("organizações PostgreSQL: RLS, papéis, convites, auditoria e isolamento de chaves", { skip: !process.env.CAMPO_RLS_TEST_URL }, async () => {
  const url = new URL(process.env.CAMPO_RLS_TEST_URL!);
  const admin = postgres(url.toString(), { ssl: false, max: 1, onnotice: () => {} });
  const database = `campo_rls_${randomUUID().replaceAll("-", "")}`;
  const originalFetch = globalThis.fetch;
  let setup: ReturnType<typeof postgres> | undefined;
  let db: typeof import("../lib/db") | undefined;
  try {
    await admin.unsafe(`CREATE DATABASE ${database}`);
    url.pathname = "/" + database;
    setup = postgres(url.toString(), { ssl: false, max: 1, onnotice: () => {} });
    await setup.unsafe(`DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
      GRANT USAGE ON SCHEMA auth TO authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;`);
    const migrations = (await readdir("supabase/migrations")).filter(name => name.endsWith(".sql")).sort();
    for (const migration of migrations) {
      if (migration.includes("professional")) await setup.unsafe("INSERT INTO notes(id,data) VALUES ('legacy', '{\"id\":\"legacy\",\"content\":\"Preservado\"}')");
      await setup.unsafe(await readFile(`supabase/migrations/${migration}`, "utf8"));
    }
    const owner = randomUUID(), other = randomUUID(), reader = randomUUID(), member = randomUUID();
    for (const [id, email] of [[owner, "owner@example.test"], [other, "other@example.test"], [reader, "reader@example.test"], [member, "member@example.test"]])
      await setup`INSERT INTO auth.users(id,email,email_confirmed_at) VALUES(${id},${email},now())`;
    process.env.CAMPO_STORAGE = "supabase"; process.env.CAMPO_AUTH = "supabase";
    process.env.CAMPO_TEST_POSTGRES = "1"; process.env.DATABASE_URL = url.toString();
    db = await import("../lib/db");
    const { withIdentity, scopeId } = await import("../lib/workspace/context");
    const { selectOrganization } = await import("../lib/workspace/service");
    const { put, list, get } = await import("../lib/db/repository");
    const orgA = (await withIdentity({ userId: owner }, () => selectOrganization())).active.id;
    const orgB = (await withIdentity({ userId: other }, () => selectOrganization())).active.id;
    assert.notEqual(orgA, orgB);
    const asA = <T>(fn: () => Promise<T>) => withIdentity({ userId: owner, organizationId: orgA, role: "owner" }, fn);
    const asB = <T>(fn: () => Promise<T>) => withIdentity({ userId: other, organizationId: orgB, role: "owner" }, fn);
    await assert.rejects(db.query("SELECT * FROM notes"), /Sessão/);
    await asA(async () => {
      assert.deepEqual(await list("notes"), []);
      await put("notes", { id: "same", content: "A" });
      await put("settings", { id: "preferences", value: "A" });
      await db!.query("INSERT INTO cache(id,provider,query,data,created_at,expires_at) VALUES ('same','test','','{}', 'now',0)");
      await put("species", { id: "species-a", scientificName: "A" });
      await put("observations", { id: "observation", code: "CAMPO-000001", speciesId: "species-a" });
    });
    await asB(async () => {
      assert.equal(await get("notes", "same"), undefined);
      await put("notes", { id: "same", content: "B" });
      await put("settings", { id: "preferences", value: "B" });
      await db!.query("INSERT INTO cache(id,provider,query,data,created_at,expires_at) VALUES ('same','test','','{}', 'now',0)");
      await put("observations", { id: "observation", code: "CAMPO-000001", speciesId: null });
      await assert.rejects(put("observations", { id: "foreign", code: "CAMPO-000002", speciesId: "species-a" }), (e: unknown) => (e as { code: string }).code === "23503");
      const changed = await db!.query("UPDATE notes SET data='{\"id\":\"legacy\"}' WHERE id='legacy' RETURNING id");
      assert.equal(changed.length, 0);
      await assert.rejects(db!.query("INSERT INTO notes(organization_id,id,data) VALUES ($1,'forced','{\"id\":\"forced\"}')", [orgA]));
    });
    assert.equal((await asA(() => get<{ content: string }>("notes", "same")))?.content, "A");
    assert.equal((await asB(() => get<{ content: string }>("notes", "same")))?.content, "B");
    const token = randomUUID();
    await asA(() => db!.query("SELECT campo_invite($1,'reader@example.test','viewer',$2)", [orgA, token]));
    await assert.rejects(asB(() => db!.query("SELECT campo_accept_invitation($1)", [token])));
    await withIdentity({ userId: reader }, () => db!.query("SELECT campo_accept_invitation($1)", [token]));
    const asReader = <T>(fn: () => Promise<T>) => withIdentity({ userId: reader, organizationId: orgA, role: "viewer" }, fn);
    await asReader(async () => {
      assert.equal((await list("notes")).length, 1);
      await assert.rejects(put("notes", { id: "no", content: "Denied" }));
      assert.equal((await db!.query("DELETE FROM notes RETURNING id")).length, 0);
      assert.equal((await db!.query("SELECT * FROM audit_events")).length, 0);
      await assert.rejects(db!.query("SELECT campo_invite($1,'member@example.test','member',$2)", [orgA, randomUUID()]));
      await assert.rejects(db!.query("UPDATE organization_members SET role='owner' WHERE user_id=$1", [reader]));
      await assert.rejects(db!.query("DELETE FROM audit_events"));
      await assert.rejects(db!.query("SELECT campo_change_member($1,$2,'owner')", [orgA, reader]));
    });
    await assert.rejects(asA(() => db!.query("SELECT campo_change_member($1,$2,NULL)", [orgA, owner])));
    const tokenMember = randomUUID();
    await asA(() => db!.query("SELECT campo_invite($1,'member@example.test','member',$2)", [orgA, tokenMember]));
    await withIdentity({ userId: member }, () => db!.query("SELECT campo_accept_invitation($1)", [tokenMember]));
    await withIdentity({ userId: member, organizationId: orgA, role: "member" }, async () => {
      await put("notes", { id: "same", content: "Edited by member" });
      await assert.rejects(db!.query("SELECT campo_change_member($1,$2,'admin')", [orgA, reader]));
    });
    await asA(async () => {
      const events = await db!.query<{ actor_id: string; before_data: { data: { content: string } }; after_data: { data: { content: string } } }>("SELECT * FROM audit_events WHERE entity_type='notes' AND operation='UPDATE'");
      assert.equal(events[0].actor_id, member);
      assert.equal(events[0].before_data.data.content, "A"); assert.equal(events[0].after_data.data.content, "Edited by member");
      const [stamps] = await db!.query<{ created_by: string; updated_by: string }>("SELECT created_by,updated_by FROM notes WHERE id='same'");
      assert.equal(stamps.created_by, owner); assert.equal(stamps.updated_by, member);
      await assert.rejects(db!.transaction(async () => { await put("notes", { id: "rollback", content: "No" }); throw new Error("rollback"); }), /rollback/);
      assert.equal((await db!.query("SELECT * FROM audit_events WHERE entity_id='rollback'")).length, 0);
      await db!.query("SELECT campo_change_member($1,$2,NULL)", [orgA, reader]);
    });
    await asReader(async () => { assert.deepEqual(await list("notes"), []); });
    assert.equal((await asB(() => db!.query("SELECT * FROM audit_events WHERE entity_id='same' AND operation='UPDATE'"))).length, 0);
    // Exercise the production API boundary with a mocked Supabase Auth provider;
    // PostgreSQL and RLS remain real. Never trusts the shared password cookie.
    const { NextRequest } = await import("next/server");
    const route = await import("../app/api/[...path]/route");
    const login = await import("../app/api/auth/route");
    process.env.SUPABASE_URL = "https://auth.example.test";
    process.env.SUPABASE_ANON_KEY = "test-public-key";
    const accounts = new Map<string, string>([[owner, "owner@example.test"], [other, "other@example.test"], [reader, "reader@example.test"], [member, "member@example.test"]]);
    const jwt = (id: string, expired = false) => [Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"), Buffer.from(JSON.stringify({ sub: id, aud: "authenticated", role: "authenticated", exp: Math.floor(Date.now()/1000)+(expired ? -10 : 3600), iat: Math.floor(Date.now()/1000)-100 })).toString("base64url"), "test-signature"].join(".");
    const providerUser = (id: string) => ({ id, email: accounts.get(id), aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, identities: [], created_at: new Date().toISOString() });
    let revoked = false;
    globalThis.fetch = async (input, init) => {
      const target = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (!target.startsWith(process.env.SUPABASE_URL!)) return originalFetch(input, init);
      if (target.includes("/token")) {
        const body = JSON.parse(String(init?.body || "{}"));
        const id = body.refresh_token ? String(body.refresh_token) : [...accounts].find(([,email]) => email === body.email)?.[0];
        if (!id || (!body.refresh_token && body.password !== "provider-password")) return Response.json({ msg: "Invalid credentials" }, { status: 400 });
        return Response.json({ access_token: jwt(id), refresh_token: id, expires_in: 3600, token_type: "bearer", user: providerUser(id) });
      }
      if (target.includes("/logout")) return Response.json({});
      if (revoked) return Response.json({ msg: "Session revoked" }, { status: 401 });
      const bearer = new Headers(init?.headers).get("authorization")?.slice(7);
      const id = bearer ? JSON.parse(Buffer.from(bearer.split(".")[1], "base64url").toString()).sub : undefined;
      return accounts.has(id) ? Response.json(providerUser(id)) : Response.json({ msg: "Unknown user" }, { status: 401 });
    };
    const headers = { host: "campo.example", origin: "https://campo.example" };
    const signIn = async (id: string) => {
      const response = await login.POST(new NextRequest("https://campo.example/api/auth", { method: "POST", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify({ email: accounts.get(id), password: "provider-password" }) }));
      assert.equal(response.status, 200);
      assert.ok(response.cookies.getAll().filter(cookie => cookie.name.startsWith("sb-")).every(cookie => cookie.httpOnly && cookie.secure));
      return response.cookies.getAll().map(cookie => `${cookie.name}=${cookie.value}`).join("; ");
    };
    const request = (cookie: string, path: string, method = "GET", value?: unknown, scope?: string) => new NextRequest(`https://campo.example/api/${path}`, { method, headers: { ...headers, cookie, ...(scope ? { "X-Campo-Scope": scope } : {}), ...(value ? { "content-type": "application/json" } : {}) }, ...(value ? { body: JSON.stringify(value) } : {}) });
    const ctx = (path: string) => ({ params: Promise.resolve({ path: path.split("/") }) });
    const ownerCookie = await signIn(owner);
    assert.equal((await route.GET(request("campo-session=shared", "storage"), ctx("storage"))).status, 401);
    assert.equal((await route.POST(request(ownerCookie, "workspace/select", "POST", { organizationId: "00000000-0000-0000-0000-000000000001" }), ctx("workspace/select"))).status, 403);
    const status = await route.GET(request(ownerCookie, "workspace"), ctx("workspace"));
    assert.equal(status.status, 200);
    assert.equal((await status.json()).organizationId, orgA);
    assert.equal((await route.POST(request(ownerCookie, "notes", "POST", { title: "Boundary", content: "Created" }), ctx("notes"))).status, 409);
    const note = await route.POST(request(ownerCookie, "notes", "POST", { title: "Boundary", content: "Created" }, `${owner}:${orgA}`), ctx("notes"));
    assert.equal(note.status, 201);
    assert.equal((await route.POST(request(ownerCookie, "notes", "POST", { title: "Wrong scope" }, `${owner}:${orgB}`), ctx("notes"))).status, 409);
    const memberCookie = await signIn(member);
    assert.equal((await route.POST(request(memberCookie, "projects", "POST", { name: "Denied" }, `${member}:${orgA}`), ctx("projects"))).status, 403);
    assert.equal((await route.POST(request(memberCookie, "import/commit", "POST", {}, `${member}:${orgA}`), ctx("import/commit"))).status, 403);
    const reInvite = randomUUID(); await asA(() => db!.query("SELECT campo_invite($1,'reader@example.test','viewer',$2)", [orgA, reInvite]));
    await withIdentity({ userId: reader }, () => db!.query("SELECT campo_accept_invitation($1)", [reInvite]));
    const readerCookie = await signIn(reader);
    assert.equal((await route.POST(request(readerCookie, "notes", "POST", { title: "Denied" }, `${reader}:${orgA}`), ctx("notes"))).status, 403);
    assert.equal((await route.GET(request(readerCookie, "workspace/audit"), ctx("workspace/audit"))).status, 403);
    assert.equal((await route.GET(request(ownerCookie + `; campo-organization=${orgB}`, "storage"), ctx("storage"))).status, 403);
    const authCookie = ownerCookie.split("; ").find(value => value.startsWith("sb-"))!;
    const [cookieName, encoded] = authCookie.split("=");
    const expiredSession = JSON.parse(Buffer.from(encoded.slice(7), "base64url").toString());
    expiredSession.access_token = jwt(owner, true); expiredSession.expires_at = Math.floor(Date.now()/1000)-10;
    const refreshCookie = `${cookieName}=base64-${Buffer.from(JSON.stringify(expiredSession)).toString("base64url")}`;
    const refreshed = await route.GET(request(refreshCookie, "storage"), ctx("storage"));
    assert.equal(refreshed.status, 200); assert.ok(refreshed.headers.get("set-cookie"));
    revoked = true;
    assert.equal((await route.GET(request(ownerCookie, "storage"), ctx("storage"))).status, 401);
    revoked = false;
    const logout = await login.DELETE(request(ownerCookie, "auth", "DELETE"));
    assert.equal(logout.status, 200);
    assert.ok(logout.cookies.getAll().some(cookie => cookie.value === ""));
    await setup`INSERT INTO public.organization_members(organization_id,user_id,role) VALUES ('00000000-0000-0000-0000-000000000001',${owner},'owner')`;
    const legacySelection = await route.POST(request(ownerCookie, "workspace/select", "POST", { organizationId: "00000000-0000-0000-0000-000000000001" }), ctx("workspace/select"));
    assert.equal(legacySelection.status, 200);
    globalThis.fetch = originalFetch;
    // Turning off Auth against the migrated database must fail closed.
    delete process.env.CAMPO_AUTH;
    await assert.rejects(db!.query("SELECT * FROM notes"), /exige CAMPO_AUTH/);
    process.env.CAMPO_PASSWORD = "shared-password-test";
    const { token: sharedToken } = await import("../lib/auth");
    assert.equal((await route.GET(request(`campo-session=${sharedToken()}`, "storage"), ctx("storage"))).status, 503);
    assert.equal((await route.POST(request(`campo-session=${sharedToken()}`, "uploads", "POST", { name: "denied.jpg", size: 1, purpose: "photo", type: "image/jpeg" }), ctx("uploads"))).status, 503);
    process.env.CAMPO_AUTH = "supabase";
    const preserved = await setup`SELECT data FROM notes WHERE id='legacy'`;
    assert.equal(preserved[0].data.content, "Preservado");
    const { scopedKey } = await import("../lib/storage/objects");
    assert.equal(await asA(async () => scopedKey("images/a.jpg")), `organizations/${orgA}/images/a.jpg`);
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-ticket-secret";
    const { createHmac } = await import("node:crypto");
    const body = Buffer.from(JSON.stringify({ key: `uploads/${randomUUID()}.bin`, name: "a.jpg", type: "image/jpeg", size: 1, purpose: "photo", expires: Date.now()+60000, scope: await asA(async () => scopeId()) })).toString("base64url");
    const ticket = body + "." + createHmac("sha256", "test-ticket-secret").update(`campo-upload:${body}`).digest("base64url");
    const { verifyTicket } = await import("../lib/storage/uploads");
    await asA(async () => assert.equal(verifyTicket(ticket, "photo").name, "a.jpg"));
    await assert.rejects(asB(async () => verifyTicket(ticket, "photo")), /outra conta/);
  } finally {
    globalThis.fetch = originalFetch;
    await db?.closeDatabase(); await setup?.end();
    await admin.unsafe(`DROP DATABASE ${database} WITH (FORCE)`); await admin.end();
  }
});
