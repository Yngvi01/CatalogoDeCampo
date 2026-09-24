import { test, expect } from "@playwright/test";
import sharp from "sharp";

test("guarda foto e notas sem rede, retoma e escolhe salvar sem fotos", async ({ page, context }) => {
  await page.goto("/");
  await page.getByLabel("Senha").fill("campo-test-only");
  await page.getByRole("button", { name: "Entrar no catálogo" }).click();
  await expect(page.getByRole("region", { name: "Rascunhos no aparelho" })).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>(resolve => navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true }));
  });
  await context.setOffline(true);
  await page.goto("/sem-conexao");
  await expect(page.getByRole("heading", { name: "Registre agora. Identifique depois." })).toBeVisible();
  const image = await sharp({ create: { width: 320, height: 400, channels: 3, background: "#6b8a54" } }).png().toBuffer();
  await page.getByLabel("Fotos (até 5, 20 MB cada)").setInputFiles({ name: "campo.png", mimeType: "image/png", buffer: image });
  await page.getByLabel("Local / região").fill("Serra gaúcha sem rede");
  await page.getByLabel("Notas de campo").fill("Folhas observadas perto da trilha.");
  await page.getByRole("button", { name: "Guardar rascunho no aparelho" }).click();
  await expect(page.getByRole("status")).toContainText("Rascunho guardado neste aparelho");
  await context.setOffline(false);
  await page.goto("/");
  const drafts = page.getByRole("region", { name: "Rascunhos no aparelho" });
  await expect(drafts.getByText("Serra gaúcha sem rede")).toBeVisible();
  await drafts.getByRole("button", { name: "Continuar rascunho" }).click();
  const dialog = page.getByRole("dialog", { name: "Nova observação" });
  await expect(dialog.getByLabel("Local / região")).toHaveValue("Serra gaúcha sem rede");
  await expect(dialog.getByLabel("Notas de campo")).toHaveValue("Folhas observadas perto da trilha.");
  await expect(dialog.getByRole("img", { name: "campo.png" })).toBeVisible();
  await dialog.getByRole("button", { name: "Identificar fotos" }).click();
  await dialog.getByRole("button", { name: "Continuar com identificação manual" }).click();
  await expect(dialog.getByRole("checkbox", { name: "Guardar foto 1" })).not.toBeChecked();
  await dialog.getByRole("button", { name: "Salvar observação sem fotos" }).click();
  await expect(drafts.getByText("Nenhum rascunho pendente.", { exact: false })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Observação salva sem fotos.");
});
