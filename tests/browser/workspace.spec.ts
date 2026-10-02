import { test, expect } from "@playwright/test";
test("interface profissional: organizações, convite, papéis e auditoria", async ({ page }) => {
  await page.goto("/login"); await page.getByLabel("Senha").fill("campo-test-only"); await page.getByRole("button", { name: "Entrar no catálogo" }).click();
  await expect(page.getByRole("button", { name: "Nova observação", exact: true })).toBeVisible();
  const owner = "11111111-1111-4111-8111-111111111111", org = "22222222-2222-4222-8222-222222222222";
  const token = "33333333-3333-4333-8333-333333333333";
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/auth", route => route.request().method() === "GET" ? route.fulfill({ json: { professional: true } }) : route.continue());
  await page.route("**/api/workspace**", route => {
    const action = new URL(route.request().url()).pathname.split("/").at(-1);
    if (action === "workspace") return route.fulfill({ json: { scope: `${owner}:${org}`, user: { id: owner, email: "owner@example.test" }, organizations: [{ id: org, name: "Equipe de campo", role: "owner" }], organizationId: org, role: "owner" } });
    if (action === "members") return route.fulfill({ json: { members: [{ user_id: owner, email: "owner@example.test", role: "owner" }], invitations: [] } });
    if (action === "invite") { expect(route.request().postDataJSON()).toEqual({ email: "member@example.test", role: "member" }); return route.fulfill({ json: { token, expiresInDays: 7 } }); }
    if (action === "audit") return route.fulfill({ json: { events: [{ id: "1", actor_id: owner, entity_type: "observations", entity_id: "registro", operation: "UPDATE", occurred_at: "2026-10-02T12:00:00Z", before_data: { latitude: -29 }, after_data: { latitude: -30 } }] } });
    return route.fulfill({ status: 400, json: { error: "Mantenha ao menos um proprietário." } });
  });
  await page.reload(); await page.getByRole("button", { name: "Equipe de campo", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Organizações e equipe" });
  await expect(dialog.getByLabel("Organização ativa")).toHaveValue(org);
  await dialog.getByLabel("E-mail do convidado", { exact: true }).fill("member@example.test");
  await dialog.getByRole("button", { name: "Gerar convite", exact: true }).click();
  await expect(dialog.getByLabel("Link do convite", { exact: true })).toHaveValue(`http://127.0.0.1:3002/?invite=${token}`);
  await dialog.getByRole("button", { name: "Ver auditoria" }).click();
  const audit = dialog.getByRole("region", { name: "Auditoria" }); await expect(audit).toContainText("observations");
  await audit.locator("summary").click(); await expect(audit).toContainText('"antes"'); await expect(audit).toContainText('"latitude": -30');
  await dialog.getByRole("button", { name: "Remover", exact: true }).click(); await expect(dialog).toContainText("Mantenha ao menos um proprietário.");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBeTruthy();
  expect(errors).toEqual([]);
});
