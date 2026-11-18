import { test, expect } from "@playwright/test";

test("cadastro permite reenviar confirmação e recuperar a senha", async ({ page }) => {
  const requests: { action: string; email?: string }[] = [];
  await page.route("**/api/auth", async route => {
    const request = route.request();
    if (request.method() === "GET") {
      await route.fulfill({ json: { professional: true } });
      return;
    }
    if (request.method() === "DELETE") {
      await route.fulfill({ json: { ok: true } });
      return;
    }
    const body = request.postDataJSON() as { action: string; email?: string };
    requests.push(body);
    await route.fulfill({ json: body.action === "signup" ? { ok: true, confirmationRequired: true } : { ok: true } });
  });

  await page.goto("/login");
  await page.getByRole("button", { name: "Ainda não tem conta? Criar cadastro" }).click();
  await page.getByLabel("E-mail").fill("teste@example.com");
  await page.getByLabel("Senha", { exact: true }).fill("senha-longa-de-teste-123");
  await page.getByLabel("Confirme a senha").fill("senha-longa-de-teste-123");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByRole("heading", { name: "Confirme seu e-mail." })).toBeVisible();
  await page.getByRole("button", { name: "Reenviar confirmação" }).click();
  await expect(page.getByRole("status")).toContainText("novo link de confirmação");

  await page.getByRole("button", { name: "Voltar para entrar" }).click();
  await page.getByRole("button", { name: "Esqueceu a senha? Recuperar acesso" }).click();
  await page.getByLabel("E-mail").fill("teste@example.com");
  await page.getByRole("button", { name: "Enviar link de recuperação" }).click();
  await expect(page.getByRole("heading", { name: "Confira seu e-mail." })).toBeVisible();

  await page.goto("/login?recovery=1");
  await page.getByLabel("Nova senha").fill("nova-senha-longa-de-teste-456");
  await page.getByLabel("Confirme a senha").fill("nova-senha-longa-de-teste-456");
  await page.getByRole("button", { name: "Salvar nova senha" }).click();
  await expect(page.getByRole("status")).toContainText("Senha atualizada");
  expect(requests.map(request => request.action)).toEqual(["signup", "resend", "recover", "updatePassword"]);
  expect(requests[3]).not.toHaveProperty("email");
});
