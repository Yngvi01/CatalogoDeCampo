import { test, expect } from "@playwright/test";
import sharp from "sharp";
test("catálogo real: login, foto, confirmação, busca, evidência e backup", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page).toHaveURL(/login/);
  await page.getByLabel("Senha").fill("campo-test-only");
  await page.getByRole("button", { name: "Entrar no catálogo" }).click();
  await expect(
    page.getByRole("button", { name: "Nova observação", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Nova observação", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  const image = await sharp({
    create: { width: 400, height: 500, channels: 3, background: "#698448" },
  })
    .png()
    .toBuffer();
  await dialog
    .locator("input[type=file][multiple]")
    .setInputFiles({ name: "folha.png", mimeType: "image/png", buffer: image });
  await dialog.getByLabel("Local / região").fill("São Paulo — teste de campo");
  await dialog
    .getByRole("button", { name: "Salvar observação", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "CAMPO-000001", exact: true }),
  ).toBeVisible();
  await dialog
    .getByLabel("Nome científico", { exact: true })
    .fill("Passiflora edulis");
  await dialog
    .getByLabel("Justificativa / fonte externa")
    .fill("Registro de teste, identificação manual.");
  await dialog
    .getByRole("button", { name: "Salvar identificação", exact: true })
    .click();
  await expect(
    dialog.getByRole("heading", { name: "Passiflora edulis", exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Fechar", exact: true }).click();
  await page.getByRole("textbox", { name: "Busca global" }).fill("sao paulo");
  await expect(
    page.getByRole("heading", { name: "Passiflora edulis" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Limpar busca" }).click();
  await page.getByRole("button", { name: "Catálogo", exact: true }).click();
  await page.getByRole("heading", { name: "Passiflora edulis" }).click();
  await dialog.getByRole("button", { name: "Evidência", exact: true }).click();
  await dialog
    .getByLabel("Afirmação / informação")
    .fill("Folhas observadas no local informado.");
  await dialog.getByLabel("Propriedade / tag").fill("observação");
  await dialog.getByRole("button", { name: "Salvar evidência" }).click();
  await expect(
    dialog.getByText("Folhas observadas no local informado."),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Fechar", exact: true }).click();
  await page.getByRole("button", { name: "Dados e backup" }).click();
  const downloadPromise = page.waitForEvent("download");
  await dialog.getByRole("link", { name: "Baixar ZIP" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("campo-backup.zip");
  await download.saveAs("test-results/browser-backup.zip");
  await dialog
    .getByLabel("Arquivo do catálogo")
    .setInputFiles("test-results/browser-backup.zip");
  await dialog.getByRole("button", { name: "Validar e visualizar" }).click();
  await expect(
    dialog.getByRole("heading", { name: "Resumo do arquivo validado" }),
  ).toBeVisible();
  await dialog
    .getByLabel("Revisei o resumo e a estratégia de importação.")
    .check();
  await dialog
    .getByRole("button", { name: "Importar catálogo", exact: true })
    .click();
  await expect(dialog.getByRole("status")).toContainText(
    "Importação concluída",
  );
  await dialog.getByRole("button", { name: "Fechar", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Identificar", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Nova observação", exact: true })
    .click();
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: "test-results/mobile-form.png",
    fullPage: true,
  });
  await dialog.getByRole("button", { name: "Fechar", exact: true }).click();
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(page).toHaveURL(/login/);
  expect(errors).toEqual([]);
});
