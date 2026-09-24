import { test, expect } from "@playwright/test";

test("explora planta e composto com fonte, filtro do RS e efeito separado", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/lotus/search?**", route => {
    const url = new URL(route.request().url());
    const plant = url.searchParams.get("mode") === "plant";
    return route.fulfill({ json: { mode: plant ? "plant" : "compound", query: url.searchParams.get("q"), totalProducts: 1,
      hits: [{ lotusId: "LTS0075508", name: "caffeine", formula: "C8H10N4O2", inchiKey: "TEST-KEY", chemicalClass: "Purine alkaloids",
        url: "https://lotus.naturalproducts.net/compound/lotus_id/LTS0075508", taxa: plant
          ? [{ name: "Ilex paraguariensis", rank: "species", references: [{ label: "DOI 10.1000/example", url: "https://doi.org/10.1000%2Fexample" }] }]
          : [{ name: "Ilex paraguariensis", rank: "species", references: [{ label: "DOI 10.1000/example", url: "https://doi.org/10.1000%2Fexample" }] },
            { name: "Camellia sinensis", rank: "species", references: [] }],
      }] } });
  });
  await page.goto("/");
  await page.getByLabel("Senha").fill("campo-test-only");
  await page.getByRole("button", { name: "Entrar no catálogo" }).click();
  await page.getByRole("button", { name: "Pesquisa", exact: true }).click();
  const explorer = page.getByRole("region", { name: "Explorar substâncias em plantas" });
  await explorer.getByRole("combobox", { name: "Nome científico da planta" }).fill("Ilex paraguariensis");
  await explorer.getByRole("button", { name: "Buscar relações" }).click();
  await expect(explorer.getByRole("heading", { name: "caffeine" })).toBeVisible();
  await expect(explorer.getByRole("link", { name: /DOI 10.1000\/example/ })).toHaveAttribute("href", /doi.org/);
  await explorer.getByRole("button", { name: "Revisar esta relação" }).click();
  const review = page.getByRole("dialog", { name: "Revisar relação do LOTUS" });
  await expect(review.getByRole("button", { name: "Salvar relação revisada" })).toBeDisabled();
  await review.getByRole("textbox", { name: "O que a publicação confirma sobre esta relação?" }).fill("A publicação relata cafeína em Ilex paraguariensis.");
  await review.getByRole("checkbox", { name: /Li a fonte/ }).check();
  await review.getByRole("button", { name: "Salvar relação revisada" }).click();
  await expect(review).toHaveCount(0);
  await page.getByRole("button", { name: /Compostos/ }).click();
  await expect(page.getByRole("heading", { name: "caffeine" })).toBeVisible();
  await page.getByRole("button", { name: "Registrar efeito com fonte" }).click();
  const effect = page.getByRole("dialog", { name: "Registrar efeito com fonte" });
  await effect.getByRole("textbox", { name: "Fonte / título" }).fill("Estudo de efeito");
  await effect.getByRole("textbox", { name: "Link da fonte" }).fill("https://doi.org/10.1000/effect");
  await effect.getByRole("textbox", { name: "Afirmação verificável" }).fill("O estudo observou efeito sedativo no contexto descrito.");
  await effect.getByRole("button", { name: "Registrar efeito" }).click();
  await expect(effect).toHaveCount(0);
  await page.getByRole("button", { name: /Explorar substâncias/ }).click();
  await explorer.getByRole("combobox", { name: "Nome científico da planta" }).fill("Ilex paraguariensis");
  await explorer.getByRole("button", { name: "Buscar relações" }).click();
  await explorer.getByRole("button", { name: "Sedativo" }).click();
  await expect(explorer.getByRole("heading", { name: "caffeine" })).toBeVisible();
  await explorer.getByRole("button", { name: "Todos" }).click();
  await explorer.getByRole("button", { name: "Composto → plantas" }).click();
  await explorer.getByRole("textbox", { name: "Nome do composto" }).fill("caffeine");
  await explorer.getByRole("button", { name: "Buscar relações" }).click();
  await expect(explorer.getByText("Camellia sinensis")).toBeVisible();
  await explorer.getByRole("checkbox", { name: "Mostrar apenas espécies com ficha na biblioteca do RS" }).check();
  await expect(explorer.getByText("Ilex paraguariensis")).toBeVisible();
  await expect(explorer.getByText("Camellia sinensis")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await explorer.getByRole("button", { name: "Ansiolítico" }).click();
  await expect(explorer.getByText(/0 compostos com relações/)).toBeVisible();
  expect(errors).toEqual([]);
});
