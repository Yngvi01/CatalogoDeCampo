import { test, expect } from "@playwright/test";

test("PubChem: seleciona CID, salva composto e não inventa vínculo com planta", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/pubchem/search?**", route => route.fulfill({ json: [{
    cid: 10624, name: "Psilocybin", formula: "C12H17N2O4P",
    molecularWeight: "284.25", inchiKey: "QVDSEJDULKLHCG-UHFFFAOYSA-N",
    url: "https://pubchem.ncbi.nlm.nih.gov/compound/10624",
  }] }));
  await page.goto("/");
  await page.getByLabel("Senha").fill("campo-test-only");
  await page.getByRole("button", { name: "Entrar no catálogo" }).click();
  await page.getByRole("button", { name: "Pesquisa", exact: true }).click();
  await page.getByRole("button", { name: /Compostos/ }).click();
  await page.getByRole("button", { name: "Novo composto" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Buscar composto no PubChem").fill("psilocybin");
  await dialog.getByRole("button", { name: "Buscar", exact: true }).click();
  await dialog.getByRole("button", { name: /Psilocybin CID 10624/ }).click();
  await expect(dialog.getByLabel("Nome", { exact: true })).toHaveValue("Psilocybin");
  await expect(dialog.getByLabel("Fórmula")).toHaveValue("C12H17N2O4P");
  await dialog.getByLabel("Classe química").fill("Alcaloide");
  await dialog.getByRole("button", { name: "Salvar composto" }).click();
  const card = page.locator(".compound-card").filter({ hasText: "Psilocybin" });
  await expect(card).toContainText("PubChem CID 10624");
  await expect(card).toContainText("284.25 g/mol");
  await expect(card).toContainText("0 evidências vinculadas");
  await page.reload();
  await page.getByRole("button", { name: "Pesquisa", exact: true }).click();
  await page.getByRole("button", { name: /Compostos/ }).click();
  await expect(card).toContainText("PubChem CID 10624");
  expect(errors).toEqual([]);
});
