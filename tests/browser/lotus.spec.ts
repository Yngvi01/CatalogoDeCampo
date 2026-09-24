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
  await expect(page.getByRole("button", { name: /Ver 4 exemplos da literatura no mapa/ })).toBeVisible();
  const explorer = page.getByRole("region", { name: "Explorar substâncias em plantas" });
  await explorer.getByRole("combobox", { name: "Nome científico da planta" }).fill("Ilex paraguariensis");
  await explorer.getByRole("button", { name: "Buscar relações" }).click();
  await expect(explorer.getByRole("heading", { name: "caffeine" })).toBeVisible();
  await expect(explorer.getByRole("link", { name: /DOI 10.1000\/example/ })).toHaveAttribute("href", /doi.org/);
  await explorer.getByRole("button", { name: "Guardar para revisar" }).click();
  await expect(explorer.getByRole("button", { name: "Na lista de revisão" })).toBeVisible();
  await page.getByRole("button", { name: /Para revisar/ }).click();
  const pending = page.getByRole("region", { name: "Relações para revisar" });
  await expect(pending.getByRole("heading", { name: /caffeine/ })).toBeVisible();
  await pending.getByRole("button", { name: "Revisar relação" }).click();
  const review = page.getByRole("dialog", { name: "Revisar relação do LOTUS" });
  await expect(review.getByRole("button", { name: "Salvar relação revisada" })).toBeDisabled();
  await review.getByRole("textbox", { name: "O que a publicação confirma sobre esta relação?" }).fill("A publicação relata cafeína em Ilex paraguariensis.");
  await review.getByRole("checkbox", { name: /Li a fonte/ }).check();
  await review.getByRole("button", { name: "Salvar relação revisada" }).click();
  await expect(review).toHaveCount(0);
  await expect(pending.getByText("Nenhuma relação aguardando revisão.")).toBeVisible();
  await page.getByRole("button", { name: "Mapa de evidências" }).click();
  const evidenceMap = page.getByRole("region", { name: "Mapa de evidências por composto" });
  await expect(evidenceMap.getByText("EXEMPLO · IDENTIDADE TAXONÔMICA")).toBeVisible();
  await expect(evidenceMap.locator(".evidence-index-card")).toHaveCount(5);
  await expect(evidenceMap.getByText("Nenhum composto corresponde à busca.")).toHaveCount(0);
  await evidenceMap.getByRole("combobox", { name: "Filtrar por efeito" }).selectOption("psychedelic");
  await expect(evidenceMap.locator(".evidence-relation").filter({ hasText: "Mimosa scabrella" }).getByText("N,N-dimetiltriptamina (DMT)")).toBeVisible();
  await evidenceMap.getByRole("combobox", { name: "Filtrar por efeito" }).selectOption("all");
  const amanitaExample = evidenceMap.locator(".evidence-relation").filter({ hasText: "Amanita muscaria" });
  await expect(amanitaExample.getByText("FUNGO")).toBeVisible();
  await amanitaExample.getByRole("button", { name: "Abrir mapa" }).click();
  await expect(evidenceMap.getByRole("heading", { name: "muscimol" })).toBeVisible();
  await evidenceMap.getByRole("button", { name: "Todos os compostos" }).click();
  await expect(evidenceMap.locator(".evidence-relation").filter({ hasText: "Ilex paraguariensis" }).getByText("EVIDÊNCIA INCOMPLETA")).toBeVisible();
  await evidenceMap.getByRole("button", { name: /caffeine/ }).click();
  await expect(evidenceMap.getByRole("heading", { name: "Ilex paraguariensis" })).toBeVisible();
  await expect(evidenceMap.getByText("A publicação relata cafeína em Ilex paraguariensis.")).toBeVisible();
  await expect(evidenceMap.getByText("Nenhum efeito com fonte foi registrado para este composto.")).toBeVisible();
  await page.getByRole("button", { name: /Compostos/ }).click();
  await expect(page.getByRole("heading", { name: "caffeine" })).toBeVisible();
  await page.getByRole("button", { name: "Registrar efeito com fonte" }).click();
  const effect = page.getByRole("dialog", { name: "Registrar efeito com fonte" });
  await effect.getByRole("textbox", { name: "Fonte / título" }).fill("Estudo de efeito");
  await effect.getByRole("textbox", { name: "Link da fonte" }).fill("https://doi.org/10.1000/effect");
  await effect.getByRole("textbox", { name: "Afirmação verificável" }).fill("O estudo observou efeito sedativo no contexto descrito.");
  await effect.getByRole("button", { name: "Registrar efeito" }).click();
  await expect(effect).toHaveCount(0);
  await page.getByRole("button", { name: "Mapa de evidências" }).click();
  await expect(evidenceMap.locator(".evidence-relation").filter({ hasText: "Ilex paraguariensis" }).getByText("OCORRÊNCIA + EFEITO")).toBeVisible();
  await evidenceMap.getByRole("combobox", { name: "Filtrar por efeito" }).selectOption("sedative");
  await evidenceMap.getByRole("checkbox", { name: "Ocorrência revisada e efeito com fonte" }).check();
  await expect(evidenceMap.getByText("2 relações encontradas")).toBeVisible();
  await evidenceMap.getByRole("combobox", { name: "Filtrar por tipo de estudo" }).selectOption("human");
  await expect(evidenceMap.getByText("0 relações encontradas")).toBeVisible();
  await evidenceMap.getByRole("combobox", { name: "Filtrar por tipo de estudo" }).selectOption("publication");
  await expect(evidenceMap.getByText("1 relação encontrada")).toBeVisible();
  await evidenceMap.getByRole("button", { name: /caffeine/ }).click();
  await expect(evidenceMap.getByText("O estudo observou efeito sedativo no contexto descrito.")).toBeVisible();
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
