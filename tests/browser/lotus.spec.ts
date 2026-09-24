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
  await explorer.getByRole("button", { name: "Composto → plantas" }).click();
  await explorer.getByRole("textbox", { name: "Nome do composto" }).fill("caffeine");
  await explorer.getByRole("button", { name: "Buscar relações" }).click();
  await expect(explorer.getByText("Camellia sinensis")).toBeVisible();
  await explorer.getByRole("checkbox", { name: "Mostrar apenas espécies com ficha na biblioteca do RS" }).check();
  await expect(explorer.getByText("Ilex paraguariensis")).toBeVisible();
  await expect(explorer.getByText("Camellia sinensis")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await explorer.getByRole("button", { name: "Sedativo" }).click();
  await expect(explorer.getByText(/0 compostos com relações/)).toBeVisible();
  expect(errors).toEqual([]);
});
