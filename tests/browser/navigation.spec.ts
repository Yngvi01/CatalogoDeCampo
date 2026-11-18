import { test, expect } from "@playwright/test";

test("navegação pelas áreas principais e adaptação móvel", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await page.getByLabel("Senha").fill("campo-test-only");
  await page.getByRole("button", { name: "Entrar no catálogo" }).click();

  const home = page.getByRole("region", { name: "Áreas do Campo Catálogo" });
  await expect(home.getByRole("button", { name: "Abrir Identificação" })).toBeVisible();
  await expect(home.getByRole("button", { name: "Abrir Catálogo" })).toBeVisible();
  await expect(home.getByRole("button", { name: "Abrir Laboratório" })).toBeVisible();
  await expect(home.getByRole("button", { name: "Abrir Caderno de campo" })).toBeVisible();

  await home.getByRole("button", { name: "Abrir Identificação" }).click();
  await expect(page.getByRole("heading", { name: "Identifique um organismo" })).toBeVisible();
  await page.getByRole("button", { name: "Nova identificação" }).click();
  const identification = page.getByRole("dialog", { name: "Identificar e registrar" });
  await expect(identification).toBeVisible();
  await identification.getByRole("button", { name: "Fechar" }).click();

  await page.getByRole("button", { name: "Catálogo", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Catálogo de espécies" })).toBeVisible();
  await page.getByRole("button", { name: "Fungos" }).click();
  await expect(page.getByText("Nenhuma espécie encontrada")).toBeVisible();

  await page.getByRole("button", { name: "Laboratório", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Laboratório" })).toBeVisible();
  await page.getByRole("button", { name: "Biblioteca de plantas" }).click();
  await expect(page.getByRole("region", { name: "Biblioteca de plantas do Rio Grande do Sul" })).toBeVisible();

  await page.getByRole("button", { name: "Caderno", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Caderno de campo" })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole("button", { name: "Início" })).toBeVisible();
  await page.getByRole("button", { name: "Início" }).click();
  await expect(home).toBeVisible();
  expect(errors).toEqual([]);
});
