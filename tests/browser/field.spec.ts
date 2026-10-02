import { test, expect } from "@playwright/test";
import sharp from "sharp";
const origin = "http://127.0.0.1:3002";
async function login(page: import("@playwright/test").Page) {
  await page.goto("/"); await page.getByLabel("Senha").fill("campo-test-only"); await page.getByRole("button", { name: "Entrar no catálogo" }).click();
  await expect(page.getByRole("button",{ name:"Nova observação",exact:true })).toBeVisible();
}
async function readyOffline(page: import("@playwright/test").Page) {
  await page.evaluate(async () => { await navigator.serviceWorker.ready; if (!navigator.serviceWorker.controller) await new Promise<void>(resolve => navigator.serviceWorker.addEventListener("controllerchange",()=>resolve(),{once:true})); });
}
test("coleta rápida reabre offline com projeto, formulário, fotos e GPS; sincroniza uma única vez", async ({ page, context }) => {
  page.setDefaultTimeout(15000); const errors: string[] = []; page.on("pageerror",e=>errors.push(e.message));
  await context.grantPermissions(["geolocation"]); await context.setGeolocation({ latitude:-29.3,longitude:-50.8 });
  await login(page);
  const projectResponse = await page.request.post("/api/projects", { headers:{ Origin:origin }, data:{ name:`Campo offline ${Date.now()}`, startDate:"2026-10-02", fieldDefinitions:[
    { id:"dap",label:"DAP",type:"number",required:true,unit:"cm",options:[] },
    { id:"adult",label:"Adulto",type:"boolean",required:true,options:[] },
    { id:"phenology",label:"Fenologia",type:"multi_select",options:["Flor","Fruto"] },
  ] } }); expect(projectResponse.ok()).toBeTruthy(); const project = await projectResponse.json();
  const campaign = await (await page.request.post("/api/campaigns",{headers:{Origin:origin},data:{projectId:project.id,name:"Outubro",date:"2026-10-02"}})).json();
  const site = await (await page.request.post("/api/sampling-sites",{headers:{Origin:origin},data:{projectId:project.id,name:"Parcela offline",geometry:{type:"Polygon",coordinates:[[[-50,-29],[-50.1,-29],[-50.1,-29.1],[-50,-29]]]}}})).json();
  await page.goto(`/collect.html?project=${project.id}&campaign=${campaign.id}`);
  await expect(page.locator("#context-status")).toContainText("atualizados"); await readyOffline(page);
  await context.setOffline(true); await page.reload();
  await expect(page.getByRole("heading",{name:"Coleta rápida",exact:true})).toBeVisible();
  await expect(page.getByRole("combobox",{name:"Projeto",exact:true})).toHaveValue(project.id);
  await expect(page.getByRole("combobox",{name:"Campanha",exact:true})).toHaveValue(campaign.id);
  await page.getByRole("combobox",{name:"Ponto / parcela",exact:true}).selectOption(site.id);
  await expect(page.locator("#gps-status")).toContainText("GPS atualizado");
  await page.getByRole("spinbutton",{name:"DAP (cm) *",exact:true}).fill("32.4");
  await page.getByRole("combobox",{name:"Adulto *",exact:true}).selectOption("false");
  await page.getByRole("checkbox",{name:"Flor",exact:true}).check();
  const photo = await sharp({create:{width:80,height:80,channels:3,background:"#668844"}}).png().toBuffer();
  await page.getByLabel("Fotos (opcional, até 5)").setInputFiles({name:"campo-offline.png",mimeType:"image/png",buffer:photo});
  const region = `Trilha offline ${Date.now()}`; await page.getByLabel("Local / região").fill(region);
  await page.getByRole("button",{name:"Salvar coleta e continuar"}).click();
  const queue = page.getByRole("region",{name:"Fila de sincronização"}); await expect(queue).toContainText("Salvo localmente");
  await expect.poll(async()=>page.evaluate(async()=> (await window.CampoField!.list())[0]?.photos.length)).toBe(1);
  await page.reload(); await expect(queue).toContainText(region); await expect(queue).toContainText("Salvo localmente");
  await page.setViewportSize({width:390,height:844}); expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await context.setOffline(false); await expect(queue).toContainText("Sincronizado",{timeout:30000});
  await expect.poll(async()=>page.evaluate(async()=> (await window.CampoField!.list())[0]?.photos.length)).toBe(0);
  const catalog = await (await page.request.get("/api/catalog")).json();
  const records = catalog.observations.filter((o:{region:string})=>o.region===region); expect(records).toHaveLength(1);
  expect(records[0].photos).toHaveLength(1); expect(records[0].samplingSiteId).toBe(site.id); expect(records[0].campaignId).toBe(campaign.id);
  expect(records[0].customValues).toEqual({dap:32.4,adult:false,phenology:["Flor"]});
  expect(records[0].latitude).toBe(-29.3); expect(records[0].longitude).toBe(-50.8);
  await page.getByRole("button",{name:"Tentar sincronizar"}).click();
  expect((await (await page.request.get("/api/catalog")).json()).observations.filter((o:{region:string})=>o.region===region)).toHaveLength(1);
  expect(errors).toEqual([]);
});

test("resposta perdida conserva foto até confirmação; sessão expirada não perde a coleta",async({page,context})=>{
  page.setDefaultTimeout(15000); await login(page); await page.goto("/collect.html");
  await expect(page.locator("#context-status")).toContainText("atualizados");
  const region = `Reenvio ${Date.now()}`;
  const photo = await sharp({create:{width:60,height:60,channels:3,background:"#224477"}}).png().toBuffer();
  let intercepted=false;
  await page.route("**/api/field/observations",async route=>{ if(route.request().method()==="POST" && !intercepted){intercepted=true;await route.fetch();await route.abort("failed");}else await route.continue(); });
  await page.getByLabel("Local / região").fill(region);
  await page.getByLabel("Fotos (opcional, até 5)").setInputFiles({name:"retry.png",mimeType:"image/png",buffer:photo});
  await page.getByRole("button",{name:"Salvar coleta e continuar"}).click();
  const queue=page.getByRole("region",{name:"Fila de sincronização"});
  await expect(queue).toContainText("Sem conexão",{timeout:15000});
  expect(await page.evaluate(async()=> (await window.CampoField!.list())[0].photos.length)).toBe(1);
  await page.getByRole("button",{name:"Tentar sincronizar"}).click(); await expect(queue).toContainText("Sincronizado");
  const catalog=await(await page.request.get("/api/catalog")).json(); expect(catalog.observations.filter((o:{region:string})=>o.region===region)).toHaveLength(1);
  await context.clearCookies(); await page.getByLabel("Local / região").fill("Sessão expirada em campo");
  await page.getByLabel("Fotos (opcional, até 5)").setInputFiles({name:"session.png",mimeType:"image/png",buffer:photo});
  await page.getByRole("button",{name:"Salvar coleta e continuar"}).click();
  await expect(queue).toContainText("Entre no catálogo");
  const records=await page.evaluate(async()=>await window.CampoField!.list());
  expect(records.find(r=>r.data.region==="Sessão expirada em campo")?.photos.length).toBe(1);
  await page.goto("/login"); await page.getByLabel("Senha").fill("campo-test-only"); await page.getByRole("button",{name:"Entrar no catálogo"}).click();
  await expect(page.getByRole("button",{name:"Nova observação",exact:true})).toBeVisible();
  await page.goto("/collect.html"); await page.getByRole("button",{name:"Tentar sincronizar"}).click();
  await expect(page.locator(".queue-item").filter({hasText:"Sessão expirada em campo"})).toHaveCount(0);
  expect((await(await page.request.get("/api/catalog")).json()).observations.filter((o:{region:string})=>o.region==="Sessão expirada em campo")).toHaveLength(1);
});

test("configura formulário, cria ponto e importa área pela interface do projeto",async({page})=>{
  page.setDefaultTimeout(15000); const errors:string[]=[]; page.on("pageerror",e=>errors.push(e.message));
  await login(page); await page.getByRole("button",{name:"Projetos",exact:true}).click();
  await page.getByRole("button",{name:"Novo projeto",exact:true}).click();
  const dialog=page.getByRole("dialog"); const name=`Formulário e áreas ${Date.now()}`;
  await dialog.getByLabel("Nome",{exact:true}).fill(name); await dialog.getByRole("button",{name:"Salvar projeto",exact:true}).click();
  await page.getByRole("button",{name:"Configurar formulário",exact:true}).click();
  await dialog.getByRole("button",{name:"Adicionar campo",exact:true}).click();
  await dialog.getByLabel("Nome do campo 1",{exact:true}).fill("DAP");
  await dialog.getByRole("combobox",{name:"Tipo do campo 1",exact:true}).selectOption("number");
  await dialog.getByLabel("Unidade do campo 1",{exact:true}).fill("cm");
  await dialog.getByRole("checkbox",{name:"Obrigatório",exact:true}).check();
  await dialog.getByRole("button",{name:"Adicionar campo",exact:true}).click();
  await dialog.getByLabel("Nome do campo 2",{exact:true}).fill("Coordenada auxiliar");
  await dialog.getByRole("combobox",{name:"Tipo do campo 2",exact:true}).selectOption("coordinate");
  await dialog.getByRole("button",{name:"Salvar formulário",exact:true}).click(); await expect(dialog).toHaveCount(0);
  await page.getByRole("button",{name:"Novo ponto / área",exact:true}).click();
  await dialog.getByLabel("Nome do local",{exact:true}).fill("Ponto de apoio");
  await dialog.getByLabel("Latitude do ponto",{exact:true}).fill("-29.3");
  await dialog.getByLabel("Longitude do ponto",{exact:true}).fill("-50.8");
  await dialog.getByRole("button",{name:"Salvar local",exact:true}).click();
  await expect(page.getByRole("button",{name:"Editar Ponto de apoio",exact:true})).toBeVisible();
  const geo={type:"FeatureCollection",features:[{type:"Feature",properties:{name:"Parcela importada"},geometry:{type:"Polygon",coordinates:[[[-50,-29],[-50.1,-29],[-50.1,-29.1],[-50,-29]]]}}]};
  await page.getByLabel("Arquivo GeoJSON",{exact:false}).setInputFiles({name:"parcela.geojson",mimeType:"application/geo+json",buffer:Buffer.from(JSON.stringify(geo))});
  await page.getByRole("button",{name:"Importar GeoJSON",exact:true}).click();
  await expect(page.getByRole("button",{name:"Editar Parcela importada",exact:true})).toBeVisible();
  const catalog=await(await page.request.get("/api/catalog")).json(); const project=catalog.projects.find((p:{name:string})=>p.name===name);
  expect(project.fieldDefinitions).toHaveLength(2);
  const exported=await(await page.request.get(`/api/projects/${project.id}/export?format=geojson`)).json();
  expect(exported.features.map((f:{geometry:{type:string}})=>f.geometry.type).sort()).toEqual(["Point","Polygon"]);
  await page.getByRole("link",{name:"Coleta rápida neste projeto",exact:true}).click();
  await expect(page.getByRole("spinbutton",{name:"DAP (cm) *",exact:true})).toBeVisible();
  await page.getByRole("spinbutton",{name:"DAP (cm) *",exact:true}).fill("20");
  await page.getByRole("spinbutton",{name:"Coordenada auxiliar: latitude",exact:true}).fill("-29.4");
  await page.getByRole("spinbutton",{name:"Coordenada auxiliar: longitude",exact:true}).fill("-50.9");
  await page.getByLabel("Local / região").fill("Teste de coordenada extra");
  await page.getByRole("button",{name:"Salvar coleta e continuar",exact:true}).click();
  await expect(page.getByRole("region",{name:"Fila de sincronização"})).toContainText("Sincronizado",{timeout:30000});
  const record=(await(await page.request.get("/api/catalog")).json()).observations.find((o:{region:string})=>o.region==="Teste de coordenada extra");
  await page.goto("/"); await page.getByRole("button",{name:"Projetos",exact:true}).click();
  await page.locator("button.project-card").filter({hasText:name}).click();
  await page.locator("button.project-record").filter({hasText:record.code}).click();
  await dialog.getByRole("button",{name:"Editar dados",exact:true}).click();
  await dialog.getByRole("spinbutton",{name:"Coordenada auxiliar: latitude",exact:true}).fill("-29.5");
  await dialog.getByRole("spinbutton",{name:"Coordenada auxiliar: longitude",exact:true}).fill("-51");
  await dialog.getByRole("button",{name:"Salvar alterações",exact:true}).click();
  const changed=(await(await page.request.get("/api/catalog")).json()).observations.find((o:{id:string})=>o.id===record.id);
  expect(changed.customValues[project.fieldDefinitions[1].id]).toEqual({latitude:-29.5,longitude:-51});
  expect(errors).toEqual([]);
});

test("fila conserva conta e organização originais e bloqueia envio após troca de espaço", async ({ page, context }) => {
  await login(page);
  const originalScope = "11111111-1111-4111-8111-111111111111:22222222-2222-4222-8222-222222222222";
  let activeScope = originalScope, submitted = 0;
  await page.route("**/api/field/context", route => route.fulfill({ json: { scope: activeScope, projects: [], campaigns: [], samplingSites: [] } }));
  await page.route("**/api/field/observations", async route => {
    if (route.request().method() === "POST") { submitted++; expect(route.request().headers()["x-campo-scope"]).toBe(originalScope); }
    await route.continue();
  });
  await page.goto("/collect.html"); await expect(page.locator("#context-status")).toContainText("atualizados");
  await context.setOffline(true);
  await page.getByLabel("Local / região").fill("Coleta da organização original");
  const photo = await sharp({ create: { width: 60, height: 60, channels: 3, background: "#447722" } }).png().toBuffer();
  await page.getByLabel("Fotos (opcional, até 5)").setInputFiles({ name: "scoped.png", mimeType: "image/png", buffer: photo });
  await page.getByRole("button", { name: "Salvar coleta e continuar" }).click();
  const queue = page.getByRole("region", { name: "Fila de sincronização" });
  await expect(queue).toContainText("Salvo localmente");
  activeScope = "33333333-3333-4333-8333-333333333333:44444444-4444-4444-8444-444444444444";
  await context.setOffline(false); await page.getByRole("button", { name: "Tentar sincronizar" }).click();
  await expect(queue).toContainText("pertence a outra conta ou organização");
  expect(submitted).toBe(0);
  expect(await page.evaluate(async () => (await window.CampoField!.list())[0].photos.length)).toBe(1);
  expect(await page.evaluate(async () => (await window.CampoField!.list())[0].scope)).toBe(originalScope);
  activeScope = originalScope;
  await page.getByRole("button", { name: "Tentar sincronizar" }).click(); await expect(queue).toContainText("Sincronizado", { timeout: 20000 });
  expect(submitted).toBe(1);
  expect(await page.evaluate(async () => (await window.CampoField!.list())[0].photos.length)).toBe(0);
});
