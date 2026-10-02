# Campo · Catálogo

Aplicação web pessoal para registrar plantas e fungos observados em campo, comparar possíveis identificações e explorar substâncias e publicações relacionadas às espécies. Preserva observações, fotografias, histórico de identificação, evidências revisadas e páginas de um caderno de anotações.

A interface é em português, escura e responsiva, com suporte a PWA, rascunhos offline e fila de coleta rápida. O catálogo funciona com armazenamento local (SQLite e arquivos) ou Supabase (PostgreSQL e bucket privado). Não exige conta de usuário em serviços externos para consultar e manter o catálogo local; as integrações com Pl@ntNet, speciesLink e Pexels têm configuração opcional. A hospedagem com Supabase exige um projeto e suas credenciais.

Identificação visual é uma sugestão para revisão humana. O projeto não confirma espécies automaticamente, não reconhece fungos por imagem e não determina composição química, comestibilidade ou segurança de consumo por fotografia.

## Tecnologias utilizadas

Versão do aplicativo: **0.2.0**, conforme [package.json](package.json). As versões abaixo são as declaradas nesse arquivo; as resoluções exatas das dependências ficam em [pnpm-lock.yaml](pnpm-lock.yaml).

| Camada | Tecnologias | Uso no projeto |
| --- | --- | --- |
| Aplicação | Next.js 16.3.6, React/React DOM 19.3.0, TypeScript 5.9 | App Router, interface React e rotas HTTP no runtime Node.js |
| Estilos e componentes | Tailwind CSS 4.2, PostCSS, Radix Slot, CVA, clsx, tailwind-merge, Lucide React | Estilos, variantes do Button no padrão shadcn/ui e ícones |
| Banco local | better-sqlite3 12.6, Drizzle ORM 0.45, Drizzle Kit 0.31 | SQLite, schema e migrations locais |
| Banco e arquivos na nuvem | postgres 3.4, @supabase/supabase-js 2.117 | SQL no PostgreSQL e operações no Supabase Storage |
| Validação | Zod 4.3 | Dados recebidos, documentos persistidos e importações |
| Fotografias | Sharp 0.34 | Decodificação, orientação, redimensionamento e cópias sem EXIF |
| Mapas | MapLibre GL 5.19 e tiles OpenStreetMap | Mapa de observações com coordenadas |
| Backup | fflate 0.8 e node:crypto | ZIP, checksums SHA-256 e assinaturas |
| Offline | Service worker, Cache API e IndexedDB do navegador | Página de captura e rascunhos no aparelho |
| Verificação | node:test via tsx 4.21, Playwright 1.58 e tsc | Testes de serviço, testes de navegador e tipos |

As integrações externas usam requisições HTTP no servidor; o projeto não utiliza um SDK de IA generativa. O Drizzle mantém o schema/migrations do SQLite; o repositório compartilhado executa SQL parametrizado pelos adaptadores de SQLite e PostgreSQL.

## Executar

Ambiente recomendado: **Node.js 22.13+ e pnpm 10**. A verificação desta revisão foi feita em Linux com Node.js 24.14.0 e pnpm 10.32.1. Linux não é uma exigência declarada do projeto; outras plataformas dependem da compatibilidade das dependências nativas. Caso não exista binário de `better-sqlite3` para o ambiente instalado, a compilação exige Python, make e compilador C++ (ou ferramentas equivalentes na plataforma).

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Abra a URL exibida no terminal; por padrão, `http://127.0.0.1:3000`. Se a porta estiver ocupada, o servidor de desenvolvimento escolhe outra. No modo local, o banco e as migrations são preparados automaticamente quando o serviço de dados é inicializado. Nenhuma observação fictícia é inserida. No Supabase, as migrations precisam ser aplicadas previamente pelo CLI.

Para uso diário:

```bash
pnpm build
pnpm start
```

Para escolher a porta em shells compatíveis com Bash: `PORT=3001 pnpm start`.

### Comandos disponíveis

| Comando | Finalidade |
| --- | --- |
| `pnpm dev` | Desenvolvimento em `127.0.0.1` |
| `pnpm dev:lan` | Desenvolvimento em `0.0.0.0`, exigindo senha |
| `pnpm build` | Compilação para produção |
| `pnpm start` | Executa a compilação em `127.0.0.1` |
| `pnpm start:lan` | Executa a compilação em `0.0.0.0`, exigindo senha |
| `pnpm typecheck` | Verifica os tipos sem emitir JavaScript |
| `pnpm test` | Executa `tests/*.test.ts` com tsx e node:test |
| `pnpm test:e2e` | Executa Playwright; exige uma compilação prévia |
| `pnpm db:generate` | Gera migrations do schema SQLite com Drizzle Kit |
| `pnpm db:migrate` | Inicializa o banco local e aplica migrations pendentes |

Execute os comandos na raiz do projeto. `dev` e `start` carregam `.env.local` e `.env`; `db:migrate` carrega `.env.local`. `db:generate` usa as variáveis do processo e não é necessário para instalar ou atualizar o catálogo. As migrations PostgreSQL são mantidas separadamente em `supabase/migrations/`. Não há script de lint configurado.

## Celular na rede local

1. Defina `CAMPO_PASSWORD` em `.env.local` para o modo compartilhado, ou configure as contas Supabase conforme o guia profissional.
2. Execute `pnpm dev:lan` ou, após compilar, `pnpm start:lan`.
3. No celular conectado à mesma rede, abra `http://IP-DO-COMPUTADOR:3000` (ou a porta exibida).
4. Se o firewall do Fedora bloquear a conexão, permita a porta apenas na zona da sua rede confiável. Não é necessário abrir portas no roteador.

Os comandos padrão escutam somente em `127.0.0.1`. Os comandos `:lan` exigem senha ou contas Supabase configuradas e escutam em `0.0.0.0`. Use os scripts do projeto para manter essa proteção. No modo compartilhado, a sessão dura sete dias; trocar a senha invalida as sessões anteriores.

**O fluxo de nova observação, a PWA e a geolocalização exigem contexto seguro no navegador.** `localhost`/loopback no próprio computador são exceções; no celular, use HTTPS com certificado confiável. HTTP pelo IP da rede pode permitir consultar o catálogo, mas não garante o fluxo de identificar/salvar: ele usa `crypto.subtle` para calcular hashes das fotos, inclusive ao continuar com identificação manual. Essa API [exige contexto seguro](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/subtle). Para usar essas funções na rede local, coloque um proxy HTTPS com certificado confiável pelo celular na frente do servidor. A seleção de câmera depende do navegador e do sistema operacional. Coordenadas também podem ser informadas manualmente.

Depois de abrir o app ao menos uma vez com conexão, o service worker pode abrir uma página de captura offline: fotos, data, local e notas podem ser guardados como rascunho no IndexedDB deste navegador. Quando a rede voltar, abra **Rascunhos no aparelho → Continuar rascunho**, identifique a observação e escolha quais fotos enviar ao catálogo (inclusive nenhuma). Esse fluxo de rascunhos usa envio manual; a coleta rápida tem uma fila própria de sincronização enquanto a página está aberta. Consultas aos provedores continuam exigindo conexão. O catálogo privado não é guardado no cache do service worker. Rascunhos não entram no backup do catálogo até serem enviados e podem desaparecer se os dados do site forem apagados. No modo local, o computador precisa estar ligado para consultar ou salvar no servidor pelo celular; na hospedagem, o servidor remoto precisa estar acessível.

## Configuração

### Vercel + Supabase

O modo `CAMPO_STORAGE=supabase` usa PostgreSQL e um bucket privado no Supabase, sem gravar dados no disco da Vercel. O modo `local` mantém SQLite e fotos em `CAMPO_DATA_DIR`.

1. Instale o Supabase CLI separadamente (ele não é uma dependência do projeto) e autentique com `supabase login`. Na raiz do repositório, execute `supabase init` caso ainda não exista `supabase/config.toml`; esse arquivo é gerado pelo CLI e não está versionado nesta revisão. Crie um projeto Supabase, vincule com `supabase link --project-ref SEU_REF` e aplique `supabase db push`. Consulte a [referência do CLI](https://supabase.com/docs/reference/cli/supabase-init) e o [guia de migrations](https://supabase.com/docs/guides/deployment/database-migrations). O conjunto completo de migrations ativa o esquema profissional e exige Supabase Auth, conforme o [guia de ativação](docs/CAMPO_PRO_AUTH.md). Para manter uma instalação com senha compartilhada, aplique somente as migrations até `20261002000200_field_sampling.sql`, sem a migration profissional.
2. Crie o bucket privado `campo-private`, com limite de arquivo de 50 MB.
3. Na Vercel configure `CAMPO_STORAGE=supabase`, `DATABASE_URL` (Transaction pooler, porta 6543), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET=campo-private`, `CAMPO_AUTH=supabase` e `SUPABASE_ANON_KEY`. Preserve as chaves opcionais dos provedores.
4. Faça um novo deploy. Nunca use prefixo `NEXT_PUBLIC_` nas credenciais. Cadastre as contas no Supabase Auth e entre com e-mail e senha. Em instalações anteriores com esquema compartilhado, `CAMPO_PASSWORD` continua obrigatória.

Somente as fotos escolhidas após a identificação são enviadas ao bucket por links temporários, e o servidor valida tamanho, formato e conteúdo antes de salvar a observação. Downloads usam links de cinco minutos. JSON, CSV e ZIP também passam pelo Storage para evitar o limite de resposta da Vercel. Na nuvem, cada foto pode ter até 20 MB, o conjunto até 100 MB e a importação/arquivo de backup até 50 MB. Localmente, a importação continua aceitando até 256 MB. ZIPs da nuvem contêm JSON, fotos e checksums; o arquivo SQLite só é incluído em backups locais. Ambos são importáveis nos dois modos.

Antes de atualizar ou restaurar dados por importação, o sistema preserva um ZIP em `backups/` dentro do espaço correspondente no bucket (ou `data/backups` no modo local). Os dados locais não são enviados automaticamente: use o ZIP para transferir o catálogo. Nenhuma migration SQLite deve ser executada no Supabase.

Para outra hospedagem com disco persistente, use o modo local, HTTPS e senha. `/tmp` não serve como armazenamento definitivo. Consulte os Runtime Logs da Vercel se a API informar falha de conexão ou configuração.

| Variável | Uso |
| --- | --- |
| `CAMPO_STORAGE` | `local` ou `supabase` |
| `DATABASE_URL` | Conexão PostgreSQL do Supabase, somente servidor |
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave privada para o Storage, somente servidor |
| `SUPABASE_STORAGE_BUCKET` | Bucket privado, padrão `campo-private` |
| `CAMPO_DATA_DIR` | Diretório persistente; padrão `./data` |
| `CAMPO_PASSWORD` | Senha de acesso no modo compartilhado; obrigatória para hospedagem/LAN sem contas Supabase |
| `CAMPO_AUTH` | `supabase` ativa contas, organizações e permissões; exige a migration profissional |
| `SUPABASE_ANON_KEY` | Chave anon/publishable do Supabase Auth no modo profissional |
| `PLANTNET_API_KEY` | Chave opcional do Pl@ntNet; somente no servidor |
| `SPECIESLINK_API_KEY` | Chave opcional da API do CRIA; somente no servidor |
| `PEXELS_API_KEY` | Chave opcional para as fotos de natureza da tela inicial; somente no servidor |
| `PORT` | Porta do servidor |

Chaves, `.env` e senha não são exportados. Não use prefixo `NEXT_PUBLIC_` para credenciais. Sem as três chaves opcionais, observações, identificação manual, catálogo, caderno, biblioteca, mapas, GBIF, iNaturalist, Flora e Funga via GBIF, Europe PMC, PubChem e LOTUS continuam disponíveis quando suas fontes estão acessíveis. Pl@ntNet exige sua chave; speciesLink oferece um link para consulta manual; o cartão Pexels fica indisponível. ZenQuotes não usa chave e tem reflexões locais de reserva.

No modo Supabase, uploads abandonados e cópias temporárias de exportação com mais de 24 horas são removidos em lotes nas próximas operações de upload/exportação. Fotos definitivas e backups de recuperação não são removidos por essa rotina.

## Fluxo principal

- **Identificar:** selecione até cinco fotos e consulte primeiro. As cópias reduzidas passam apenas pela memória do servidor até o provedor; nada é salvo no catálogo ou no Storage durante essa consulta. Depois do resultado, escolha quais originais guardar ou salve a observação sem fotos. Nenhuma imagem vem pré-selecionada; descartar a consulta não cria registros.
- Consulte Pl@ntNet para plantas ou os candidatos contextuais para fungos. A observação pode continuar pendente.
- Compare fontes e registre uma identificação provável, identificada pelo usuário ou confirmada externamente. A última opção exige uma justificativa/fonte.
- **Catálogo:** acompanhe a ficha da espécie e seus diferentes encontros. Registre dados pessoais e evidências, com origem e tipo claramente separados.
- **Campo:** veja observações com coordenadas no mapa e abra o registro pela lista ou marcador.
- **Meu caderno:** escreva páginas com título, texto e etiquetas, releia pelo índice, exporte em TXT ou arquive para consultar depois.
- **Biblioteca:** consulte dez fichas de plantas documentadas no Rio Grande do Sul, incluindo duas visões gerais de gêneros. Cada ficha distingue composição, uso tradicional e segurança, indica a parte estudada quando conhecida e liga as afirmações às fontes. As fotos locais incluem crédito e licença do Wikimedia Commons; nos gêneros, a espécie retratada é identificada. A biblioteca é informativa e não altera o catálogo pessoal nem valida consumo por fotografia.
- **Pesquisa → Descobertas:** investigue uma espécie ou pesquise publicações que mencionem a espécie junto de um composto na Europe PMC. Revise descobertas antes de incorporar evidências. Em **Compostos**, busque no PubChem pelo nome, escolha o CID e salve fórmula e metadados químicos; vincule a espécie somente com evidência e fonte revisadas.
- **Pesquisa → Explorar substâncias:** consulte o LOTUS por nome científico para ver compostos relatados ou por nome de composto para ver táxons relacionados. Abra a publicação e use **Revisar esta relação** para registrar a afirmação, tipo de evidência e fonte; só então a espécie, o composto e a evidência entram no catálogo. O filtro do RS abrange somente as espécies com ficha na biblioteca, não toda a flora gaúcha. Filtros de efeito usam apenas registros estruturados com fonte, separados dos dados do LOTUS.
- **Pesquisa → Para revisar:** guarde relações candidatas do LOTUS para voltar às referências depois. A lista aceita até 500 relações de espécies (não apenas de gêneros). Elas entram no backup, mas não contam como evidência. Após revisão e incorporação, saem automaticamente da lista; também é possível removê-las manualmente.
- **Pesquisa → Mapa de evidências:** filtre relações organismo–composto por efeito, contexto, tipo de estudo, fonte e ficha do RS. Escolha um composto para ver as espécies vinculadas, afirmações, fontes, parte, método e concentração informados. Efeitos estudados aparecem em coluna separada, com contexto e fonte. Campos ausentes são indicados, sem atribuir automaticamente efeito à planta.
- **Dados e backup:** exporte o ZIP completo regularmente.

Cada observação recebe um código `CAMPO-000001` e pode registrar grupo (planta/fungo), data, região, coordenadas, altitude, habitat, substrato, vegetação, luz, notas e campos de morfologia para fungos. Os dados de campo podem ser editados depois de salvar; a identificação e suas alterações ficam em histórico. A ficha da espécie reúne nome científico/aceito, nomes populares, sinônimos, família/gênero, descrição, diagnóstico, distribuição, habitat, toxicidade, usos tradicionais, notas e evidências. Consultar fontes externas não preenche nem confirma tudo isso automaticamente.

A busca global ignora acentos e caixa e abrange nomes, família, gênero, região, habitat, substrato, morfologia, propriedades, compostos, classes e alvos. Há filtros de grupo, status, período, propriedade, evidência e distância da localização atual. O catálogo é carregado em memória no navegador, adequado ao uso pessoal; paginação e índices de busca são evoluções para volumes maiores.

## Fotografias

O fluxo atual de **Nova observação** aceita **de uma a cinco fotos JPEG, PNG ou WebP**, de até **20 MB cada**. Depois da consulta, pode salvar de zero a cinco dessas fotos. Não é possível acrescentar fotos ao registro pela interface de edição atual.

O serviço de criação também aceita de uma a 12 fotos e até 100 MB por envio; esse limite não amplia o seletor da interface. No processamento do servidor, são aceitos JPEG, PNG, WebP, TIFF e HEIF quando suportado pelo build do Sharp. TIFF/HEIF não são oferecidos pelo fluxo atual de consulta no navegador. Conteúdo é decodificado antes de ser aceito, com limite de 60 megapixels.

O arquivo original é preservado, incluindo seus metadados; uma cópia orientada e otimizada de até 1800 px e uma miniatura de até 520 px são geradas sem EXIF/GPS. Apenas as cópias otimizadas são enviadas ao Pl@ntNet. SHA-256 detecta fotos repetidas e apresenta um aviso, sem descartar silenciosamente o registro.

A consulta ao Pl@ntNet usa até cinco fotos e envia a parte indicada para cada imagem (folha, flor, fruto, casca ou automático). Ao salvar o resultado inicial, são preservados os candidatos, scores, referências fotográficas, data da consulta e IDs das fotos escolhidas; a resposta bruta inicial não é mantida, apenas metadados do fluxo. Ao consultar novamente uma observação salva, a resposta do provedor também fica no registro permanente e a consulta pode usar cache. Alterações de identificação/status ficam em histórico. Scores nunca confirmam uma identificação.

### Identificar antes de guardar fotos

A consulta inicial usa JPEGs reduzidos no navegador (até 650 KB por foto), com remoção de EXIF também no servidor. Não cria observação, imagens, arquivos temporários no Storage nem cache visual. O Pl@ntNet recebe as cópias para análise; fungos usam assistência contextual, sem análise visual. Os originais permanecem no navegador até a escolha explícita de retenção. Fechar/descartar a consulta não salva nada.

O resultado assinado expira em uma hora. Ao salvar, apenas as fotos selecionadas são transferidas e relacionadas ao registro; também é possível salvar os dados e candidatos com zero imagens. Se a consulta automática falhar, a tela mantém as fotos e permite repetir ou continuar explicitamente com identificação manual. Para este fluxo, use JPEG, PNG ou WebP que o navegador consiga abrir.

### Fotografar e comparar

Em **Nova observação**, o guia orienta fotos de partes diferentes da mesma planta. Cada foto pode ser marcada como folha, flor, fruto, casca ou automático; essa seleção é enviada ao Pl@ntNet e preservada apenas nas fotos escolhidas para salvar. Após a consulta, compare até três candidatos com nomes, família, gênero, pontuação e referências disponíveis. A comparação também está na observação salva. A pontuação não representa confirmação da espécie. Consulte o [guia de boas observações do Pl@ntNet](https://docs.plantnet.org/en/cookbook/making-a-good-observation/).

### Excluir uma identificação salva

Abra a observação, clique em **Excluir identificação** e confirme **Excluir definitivamente**. A exclusão remove a observação, consultas, histórico e fotos vinculadas. A ficha da espécie, suas pesquisas/evidências e outras observações são preservadas. Arquivos compartilhados por outro registro não são apagados. Backups já exportados não são alterados.

O banco registra a limpeza de arquivos antes de remover o registro. Se o disco ou Storage estiver indisponível, a interface informa a pendência e tenta novamente ao carregar o catálogo. Nenhum registro é excluído apenas ao abrir ou cancelar a confirmação.

## Caderno de anotações

Em **Meu caderno**, cada anotação é uma página com título, texto livre, etiquetas e datas de criação/edição. O índice permite alternar páginas em uma leitura semelhante a um livro. A busca do caderno e a busca global nessa área ignoram acentos e maiúsculas, pesquisando títulos, textos e etiquetas.

Use **Salvar página** (ou Ctrl/⌘ S) para gravar no banco configurado. A edição avisa antes de descartar mudanças ao fechar o editor ou sair da página. Não há salvamento automático nem gravação offline: se o envio falhar, mantenha o editor aberto ou copie o texto antes de sair. Alterações concorrentes em outra janela são bloqueadas para não sobrescrever a versão mais recente.

**Arquivar** mantém a página guardada e pesquisável em **Arquivadas**; **Restaurar página** devolve ao caderno. Também é possível baixar cada página como TXT. Não há exclusão definitiva na interface.

## Biblioteca e exemplos de interface

A biblioteca reúne dez fichas editoriais em [features/library/entries.ts](features/library/entries.ts), com busca, filtros, links de fontes e fotos com autoria/licença em [features/library/images.json](features/library/images.json).

| Nome | Táxon da ficha | Escopo |
| --- | --- | --- |
| Corticeira-da-serra | *Erythrina falcata* | Espécie |
| Bracatinga | *Mimosa scabrella* | Espécie |
| Corda-de-viola | *Ipomoea spp.* | Gênero; foto de *I. purpurea* |
| Carqueja | *Baccharis trimera* | Espécie |
| Marcela / macela | *Achyrocline satureioides* | Espécie; inclui alias *A. saturejoides* |
| Erva-mate | *Ilex paraguariensis* | Espécie |
| Espinheira-santa | *Monteverdia ilicifolia* | Espécie; inclui alias *Maytenus ilicifolia* |
| Erva-cidreira-do-campo | *Aloysia gratissima* | Espécie |
| Maracujás-do-mato | *Passiflora spp.* | Gênero; foto de *P. alata* |
| Fumo-bravo | *Solanum mauritianum* | Espécie |

As fichas de gênero não atribuem a mesma composição a todas as espécies. O recorte do RS nos filtros de pesquisa considera apenas fichas de espécie e seus aliases; não é um inventário da flora do estado.

O catálogo também apresenta quatro cards ilustrativos: *Ipomoea violacea*, *Casearia sylvestris*, *Mimosa scabrella* e *Amanita muscaria*. São demonstrações estáticas, com imagens, fontes e avisos, sem criar registros pessoais ou entrar no backup. Os antigos exemplos de pesquisa foram separados e depois removidos pelas migrations `0004`/`0005` do SQLite e pelas migrations correspondentes do Supabase. O mapa de evidências usa os dados do catálogo pessoal.

## Tela inicial

### Reflexões

O bloco **Uma pausa para pensar** exibe frases em inglês do [ZenQuotes](https://docs.zenquotes.io/zenquotes-documentation/), com autor e crédito/link do serviço. Não exige chave nem dependência adicional. A seleção muda aleatoriamente a cada 60 segundos, sem repetição imediata; é possível pausar, retomar ou avançar manualmente. A rotação para quando a aba fica oculta e respeita a preferência por movimento reduzido na transição.

O backend busca um lote de frases e o mantém no cache do banco por 24 horas. Cada troca acontece no navegador, sem nova chamada externa. Em caso de falha, preserva o último lote disponível e aguarda 15 minutos antes de tentar novamente. Sem cache, exibe reflexões originais do Campo, identificadas como tal. O serviço recebe uma consulta genérica do servidor; não recebe fotos, coordenadas ou dados do catálogo. O plano gratuito retorna reflexões gerais, sem promessa de filtro por filosofia ou psicologia.

### Fotos de natureza (Pexels)

A tela inicial inclui **Janela para a natureza**, com fotos aleatórias de plantas e florestas e o botão **Ver outra paisagem**. Configure `PEXELS_API_KEY` somente no servidor (na Vercel, em Production e Preview). Obtenha a chave na [página da API do Pexels](https://www.pexels.com/api/).

O servidor busca até 80 fotos e guarda apenas URLs e créditos no cache por 24 horas. As imagens carregam diretamente do Pexels, sem entrar no catálogo ou no bucket. O sorteio ocorre no navegador, sem nova consulta ao provedor por clique. Em caso de falha, o último lote em cache continua disponível; sem cache, o cartão informa a indisponibilidade. Os créditos do fotógrafo e do Pexels acompanham cada imagem. As frases continuam independentes.

## Fontes e limites de interpretação

| Provider | Implementação |
| --- | --- |
| Pl@ntNet | Identificação visual de plantas; exige chave para consultar; nova consulta sobre fotos salvas tem cache de 30 dias; a prévia inicial não usa cache visual |
| GBIF | Taxonomia, ocorrências no Brasil ou caixa de ±0,25° e contagem no mês da observação |
| Flora e Funga do Brasil | Lista oficial publicada pelo JBRJ no GBIF, com correspondência exata, sinônimos e distribuição; sem scraping do Reflora |
| iNaturalist | Táxons e ocorrências com grau de pesquisa no Brasil ou raio de 25 km, incluindo contagem no mês |
| speciesLink | API v1.0 do CRIA quando configurada; sem chave, link para consulta no portal |
| Europe PMC | Até 40 artigos por consulta, pesquisando nome aceito e até sete sinônimos com os temas científicos definidos |
| PubChem | Busca de compostos por nome via PUG REST; CID, fórmula, massa molecular e InChIKey com cache de sete dias; não exige chave |
| LOTUS | Relações entre produtos naturais e táxons vegetais com referências; consulta iniciada pelo usuário, cache compacto de 14 dias, até 150 resultados e limite de resposta |
| Fungos | Histórico pessoal por contexto/morfologia e, com coordenadas, até oito espécies registradas no iNaturalist a 25 km no mesmo mês |
| ZenQuotes | Reflexões da tela inicial; lote em cache por 24 horas e textos locais de reserva |
| Pexels | Paisagens da tela inicial; exige chave; até 80 URLs/créditos em cache por 24 horas |
| OpenStreetMap | Tiles raster carregados diretamente pelo navegador para o mapa; sem chave |

Providers separados implementam `IdentificationProvider`, `TaxonomyProvider`, `OccurrenceProvider` e `LiteratureProvider`. O cache persistente usa provider, parâmetros, consulta, resposta, criação e validade. As demais consultas têm validade de um dia. Atualizações manuais estão disponíveis na comparação, identificação e pesquisa.

**Fungos:** não há classificação visual automática nem modelo generativo. A correspondência morfológica local compara campos preenchidos; o histórico exige pelo menos dois critérios em comum. Os registros do iNaturalist são candidatos geográficos, sem inferência de compatibilidade visual ou de comestibilidade. A interface mostra critérios e fontes. Um modelo local futuro pode implementar a mesma interface.

**Comparação:** cada candidato pode ser consultado separadamente. Ocorrências geográficas, sazonalidade e taxonomia são apresentadas sem fundir scores. A caixa GBIF/speciesLink e o raio iNaturalist são diferentes e identificados na interface. Ausência de registros não prova ausência biológica. Compatibilidade diagnóstica de habitat e morfologia exige revisão humana; não há uma porcentagem agregada ou confirmação automática.

**Literatura:** resultados nunca alteram a ficha automaticamente. Incorporar exige escrever a afirmação e escolher seu tipo de evidência. Parte da planta/fungo, concentração, unidade, intervalo, método e origem da amostra ficam na relação espécie–composto, com fonte. As informações textuais do composto são anotações; suas referências são vinculadas nas evidências das espécies. Não são geradas doses nem recomendações de consumo.

**PubChem:** a seleção de um resultado preenche nome e fórmula e salva seu CID no composto; classe, mecanismos e toxicologia continuam editáveis e não são inferidos automaticamente. Efeitos são registrados em **Compostos → Registrar efeito com fonte**, com efeito, contexto estudado, tipo de evidência, afirmação e link. Anotações antigas de efeitos permanecem visíveis, mas não alimentam os filtros. O PubChem identifica a substância, mas não demonstra que ela ocorre numa espécie ou em determinada parte da planta. A lista de compostos mostra separadamente as evidências vinculadas às espécies, com suas fontes. A consulta passa pelo servidor autenticado e usa cache para reduzir chamadas externas.

**LOTUS:** os resultados externos permanecem na exploração até revisão; não criam automaticamente compostos, evidências ou espécies no catálogo. O formulário de revisão exige uma afirmação conferida, link da publicação e confirmação explícita; evita repetir a mesma relação e fonte. A busca por espécie exige correspondência exata nos táxons associados às referências; buscas `spp.` permanecem identificadas como buscas de gênero. A API pode retornar muitos dados ou demorar para táxons amplos; nesses casos a interface informa a falha e oferece consulta direta à fonte. Parte analisada, método e concentração não vêm dessa busca e precisam ser verificados nas publicações.

**Privacidade:** no modo local, os dados ficam no computador. No modo Supabase, registros e fotos ficam no projeto Supabase e são acessados pelo servidor Vercel autenticado. Consultas iniciadas pelo usuário enviam nomes científicos e, quando necessário, coordenadas aos respectivos providers. Abrir o mapa carrega tiles do OpenStreetMap. Fotos do Pexels e imagens de referência dos candidatos são carregadas pelo navegador diretamente de suas fontes, que recebem essas requisições. As imagens da biblioteca e dos cards ilustrativos são arquivos locais distribuídos com o app. ZenQuotes e Pexels recebem consultas genéricas do servidor ao abrir a tela inicial, conforme o cache; não recebem os dados pessoais do catálogo. O Pl@ntNet recebe fotos apenas quando acionado. Originais podem conter EXIF; ficam no armazenamento configurado (disco local ou bucket privado) e no backup completo.

## Acesso e armazenamento

No modo compartilhado, o acesso usa uma senha, com cookie de sessão HttpOnly e SameSite Strict (Secure quando acessado por HTTPS). A sessão assinada dura sete dias; alterar `CAMPO_PASSWORD` invalida sessões anteriores. Requisições de alteração precisam ter a mesma origem. O login limita novas tentativas após dez senhas incorretas dentro de uma janela de 15 minutos; esse contador é mantido na memória de cada processo.

Sem senha no modo local, o acesso é liberado. Os scripts padrão restringem o servidor a loopback; os scripts de LAN exigem senha ou contas Supabase configuradas. Na hospedagem, a API exige senha no modo compartilhado ou uma conta verificada no modo profissional. `CAMPO_AUTH=supabase` adiciona contas, organizações, papéis e isolamento RLS. O [guia profissional](docs/CAMPO_PRO_AUTH.md) descreve a ativação, preservação dos dados anteriores e limites.

No modo local, os arquivos ficam em `CAMPO_DATA_DIR` (padrão `./data`):

```text
data/
├── database.sqlite       # catálogo e cache; SQLite em WAL
├── database.sqlite-wal   # pode existir enquanto o banco estiver aberto
├── database.sqlite-shm   # pode existir enquanto o banco estiver aberto
├── images/               # originais, cópias otimizadas e miniaturas
└── backups/              # cópias de recuperação antes de atualizar/restaurar
```

No Supabase, o PostgreSQL guarda registros e cache. O bucket privado guarda `images/`, `backups/`, `uploads/` temporários e `exports/` temporários. No modo profissional, esses caminhos ficam sob `organizations/<id>/`, exceto os arquivos preservados do catálogo anterior. As credenciais são usadas apenas no servidor; uploads selecionados e downloads usam URLs assinadas. O modo profissional autentica pessoas pelo Supabase Auth. Nem a senha nem o bucket privado substituem criptografia do disco ou das cópias exportadas: o ZIP de backup não é protegido por senha.

## Backup e transferência

JSON contém `format: "campo-catalogo"`, `version: 4`, `exportedAt` e `data`, com projetos, campanhas, pontos/parcelas, espécies, observações, imagens (metadados), identificações, histórico, compostos, evidências/propriedades/referências, descobertas, pesquisas, páginas do caderno (incluindo arquivadas), preferências permitidas e relações LOTUS guardadas para revisão. Efeitos estruturados estão nos registros dos compostos. JSON **não inclui arquivos de imagem**. A prévia informa fotos ausentes no destino; importar o JSON não recupera esses arquivos. Use um ZIP completo para transferir também as fotos. CSV é oferecido para espécies, observações e compostos, com neutralização de fórmulas de planilha.

ZIP completo:

```text
campo-backup.zip
├── manifest.json       # versões, data, contagens e checksums SHA-256
├── database.sqlite     # somente no modo local; snapshot consistente com cache
├── export.json         # dados portáveis e validados
└── images/             # originais, otimizadas e miniaturas
```

A importação valida versão, schema, IDs, códigos, relações, checksums, presença de fotos e caminhos antes de apresentar a prévia. Limites: arquivo de até 256 MB no modo local ou 50 MB na nuvem; expansão do ZIP de até 1 GB e 20 mil entradas. Exportações na nuvem (JSON, CSV e ZIP) também têm limite de 50 MB por arquivo. O ZIP é processado em memória; para catálogos maiores será necessário evoluir para streaming.

- **Ignorar existente:** preserva registros de mesmo ID e adiciona IDs novos.
- **Atualizar:** sobrescreve IDs existentes e salva um backup anterior.
- **Importar como novo:** cria novos IDs, códigos e relações; é uma duplicação deliberada.
- **Restaurar completamente:** exige ZIP e substitui os dados do catálogo, preservando IDs e relações; cria antes um ZIP em `CAMPO_DATA_DIR/backups/` ou `backups/` no bucket.

Conflitos de código CAMPO entre IDs diferentes são bloqueados em mesclagens. O arquivo precisa ser o mesmo que foi pré-visualizado. Dados são gravados em transação; novos arquivos são revertidos quando a transação falha. Imagens existentes nunca são sobrescritas: divergências recebem novos nomes. Arquivos antigos não referenciados são mantidos, evitando apagar fotos durante a restauração.

A restauração reconstrói as tabelas **a partir do JSON versionado** com as migrations atuais; não substitui o arquivo SQLite aberto nem executa SQL de um arquivo enviado. Backups locais também preservam um snapshot SQLite para recuperação independente. JSON/ZIP versões 1, 2 e 3 continuam sendo aceitos; a versão 2 inclui páginas do caderno, a versão 3 adiciona projetos/campanhas e a versão 4 adiciona locais e formulários de campo. Uma restauração completa de backup antigo esvazia o caderno, como indicado na prévia, depois de preservar o estado atual no backup de recuperação. Use esta versão ou uma mais recente do aplicativo para importar o formato 4. Cache externo não é necessário para restaurar o catálogo; identificações permanentes estão no JSON. Restaurações não importam credenciais.

Para transferir: instale o projeto no destino, inicie, abra Dados e backup, selecione o ZIP, valide a prévia e escolha restaurar. Guarde cópias em outro dispositivo; `data/backups/` no mesmo disco não protege contra perda física do computador.

## Arquitetura

```text
app/                       Next.js App Router, página principal, login e rotas HTTP
components/                Interface principal e componentes compartilhados
features/catalog/          Cards ilustrativos do catálogo
features/observations/     Registro, edição, exclusão e histórico
features/identification/   Prévia, guia de fotos e comparação de candidatos
features/species/          Ficha, observações e evidências
features/library/          Fichas editoriais e créditos de imagens
features/research/         Publicações, compostos, efeitos e revisão LOTUS
features/notebook/         Caderno, leitura e edição de páginas
features/map/              MapLibre + tiles OpenStreetMap
features/projects/         Projetos, campanhas, locais GeoJSON e formulários
features/field/            Fila de coleta rápida no catálogo
features/backup/           Exportação e restauração
features/reflections/      Reflexões e textos locais de reserva
features/nature/           Fotos de natureza da tela inicial
lib/db/                    Schema, migrations SQLite, adaptadores e repositório
lib/storage/               Processamento, uploads e armazenamento de fotos
lib/validation/            Schemas Zod e limites de leitura HTTP
lib/http/                  Preparação de fotos, uploads e respostas no cliente
lib/offline/               Rascunhos e acesso à fila IndexedDB
lib/providers/             Adaptadores externos e cache persistente
lib/server/                Manipuladores das rotas da API
public/                    PWA, captura offline e imagens editoriais locais
scripts/                   Inicialização, migrations e servidor de testes E2E
supabase/migrations/       Migrations PostgreSQL
tests/                     Testes de serviço e navegador
proxy.ts                   Controle de sessão e origem das requisições
```

O repositório assíncrono usa SQLite com WAL no modo local e PostgreSQL com pool de transações no Supabase. Ambos preservam chaves estrangeiras e documentos validados. Transações PostgreSQL usam um lock compartilhado entre instâncias para numeração e alterações concorrentes. SQLite não deve ser compartilhado entre várias instâncias nem colocado em filesystem de rede.

A página principal é uma interface React que alterna áreas no cliente; as áreas não são rotas independentes. `/api/auth` controla login/logout e `/api/[...path]` concentra as operações autenticadas, delegando a `lib/server/api-handlers.ts`. A API usa runtime Node.js e respostas dinâmicas.

### Limites atuais e possíveis evoluções

- Fungos recebem assistência por contexto; um modelo visual local ainda não existe.
- Busca e filtros usam o catálogo carregado no navegador. Paginação e índices de busca para grandes volumes ainda não foram implementados.
- ZIPs são montados e importados em memória. Backup em streaming ainda não foi implementado.
- Offline cobre rascunhos e a coleta rápida com fila de envio automático enquanto a página está aberta. Não inclui o catálogo completo, consultas externas, salvamento do caderno ou sincronização com o navegador fechado.
- O mapa exige WebGL e conexão para carregar tiles; a lista de observações continua disponível se o mapa falhar.
- Fontes externas podem falhar, limitar consultas ou não retornar resultados; ausência de resultado não confirma ausência de uma espécie ou composto.

Essas evoluções são possibilidades, não funcionalidades entregues nem um cronograma de desenvolvimento.

## Verificação

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium  # primeira execução, se necessário
pnpm test:e2e
```

Testes de serviço usam bancos temporários e verificam registro, fotos/EXIF, prévia de identificação, histórico, exclusão e limpeza pendente, conflitos, relações, backup/restauração, versões de arquivo, corrupção, path traversal, URLs perigosas, CSV, autenticação, comportamento de implantação, caderno e integrações. Os testes dos provedores usam respostas simuladas; passar a suíte não confirma disponibilidade ou validade das credenciais de serviços externos.

A suíte de navegador inicia uma compilação de produção protegida na porta 3002, com banco temporário, e percorre login, fotos, identificação manual, confirmação, comparação, busca sem acentos, evidência, ZIP, caderno, biblioteca, PubChem, LOTUS, rascunhos offline e tela móvel. Alguns resultados externos são simulados. A porta 3002 precisa estar livre. Para garantir o modo local mesmo se o terminal tiver variáveis de nuvem exportadas, use `CAMPO_STORAGE=local pnpm test:e2e` (Bash). O servidor E2E não carrega `.env.local`/`.env` e remove seu diretório temporário ao encerrar.

### Integração real com Supabase

Com variáveis de um projeto de teste configuradas, execute `CAMPO_SUPABASE_TEST=1 node --env-file=SEU_ARQUIVO_PRIVADO --import tsx --test tests/supabase.test.ts`. O teste verifica transações, conflitos, upload assinado, privacidade e backup; remove apenas os registros que criou. A suíte padrão não acessa Supabase.

Use um projeto de teste dedicado: esse teste acessa serviços reais e não faz parte da verificação padrão. Não é necessário configurar Supabase para executar os demais testes.

## Documentação das integrações

- [Pl@ntNet: identificação](https://my.plantnet.org/doc/api/identify)
- [GBIF: API](https://techdocs.gbif.org/en/openapi/)
- [Flora e Funga: dataset oficial no GBIF](https://www.gbif.org/dataset/aacd816d-662c-49d2-ad1a-97e66e2a2908)
- [iNaturalist: API v1](https://api.inaturalist.org/v1/docs/)
- [speciesLink: API v1.0](https://specieslink.net/ws/1.0/)
- [Europe PMC: serviço REST](https://europepmc.org/RestfulWebService)
- [PubChem: PUG REST](https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest)
- [LOTUS: documentação e API](https://lotus.naturalproducts.net/documentation)
- [ZenQuotes: documentação](https://docs.zenquotes.io/zenquotes-documentation/)
- [Pexels: API](https://www.pexels.com/api/)
- [Pl@ntNet: guia para boas observações](https://docs.plantnet.org/en/cookbook/making-a-good-observation/)


## Campo Pro — projetos e campanhas

As fases 1 e 2 do [roadmap Campo Pro](docs/CAMPO_PRO_ROADMAP.md) estão implementadas. Em **Projetos**, crie um projeto, organize campanhas e acompanhe observações, espécies, pendências de identificação, confirmações externas, equipe e mapa. Membros e responsáveis são informações do projeto; as contas e permissões da Fase 3 são gerenciadas na organização, separadamente desses nomes informativos.

Use **Registrar no projeto** ou **Registrar na campanha** para preencher o vínculo na nova observação. Para associar um registro antigo, abra **Editar dados** e selecione projeto/campanha. A opção **Pessoal · sem projeto** mantém o uso individual. O mesmo registro continua aparecendo no catálogo, sem duplicação.

As exportações por projeto oferecem CSV, JSON, GeoJSON e ZIP, filtrados por campanha, período, espécie e ponto/parcela. O ZIP inclui as fotos do recorte e pode ser mesclado pelo fluxo de importação. GeoJSON inclui observações com coordenadas e geometrias de pontos/parcelas. Backup completo e restauração preservam projetos e campanhas no formato 4, mantendo leitura dos formatos anteriores.

SQLite aplica a migration automaticamente. Para instalações Supabase, aplique as migrations de projetos e amostragem no PostgreSQL antes de atualizar a aplicação. Veja os [itens entregues, limites e próximas fases](docs/CAMPO_PRO_PROGRESS.md).


### Coleta rápida, parcelas e formulários

Abra **Coleta rápida neste projeto** ou **Abrir coleta rápida**. Com conexão, a página prepara projetos, campanhas, pontos e formulários para o aparelho. Depois pode reabrir offline, guardar fotos e registros no IndexedDB e enviar quando a conexão retornar. A página precisa permanecer aberta para sincronizar; dados pendentes continuam no aparelho se a sessão expirar e podem ser enviados após entrar novamente. Os rascunhos tradicionais continuam disponíveis para identificação e envio manual.

Em **Configurar formulário**, adicione os campos extras do projeto. Em **Pontos, trilhas e parcelas**, crie locais ou importe GeoJSON com Point, LineString ou Polygon (até 2 MB). As geometrias aparecem no mapa; os vínculos e campos extras acompanham observações, exportações e backup 4. Campos com dados existentes podem ser desativados para preservar o histórico.

A fila libera as fotos locais somente depois que o servidor confirma o recebimento. Coletas pendentes e metadados preparados são dados privados deste navegador e não entram no backup do catálogo até o envio. O envio repetido usa o mesmo identificador e não cria outra observação. A captura rápida não consulta identificação automática; um nome informado é uma identificação do usuário.

### Contas e organizações (opcional)

A Fase 3 adiciona login com Supabase Auth, organizações, convites, quatro papéis, isolamento RLS e auditoria. O modo local continua disponível. Para ativar em PostgreSQL, siga o [guia de configuração profissional](docs/CAMPO_PRO_AUTH.md), incluindo a migration `20261002000300_professional_workspaces.sql`, `CAMPO_AUTH=supabase` e `SUPABASE_ANON_KEY`. A migration profissional exige esse modo a partir da ativação. Os dados anteriores ficam preservados e precisam ser atribuídos explicitamente a uma conta pelo operador.

A instalação [catalogo-de-campo.vercel.app](https://catalogo-de-campo.vercel.app) está com o modo profissional ativado desde 02/10/2026. Login real, permissões, isolamento, fotos e exportações foram verificados no Supabase e na Vercel. Veja o [registro da implantação](docs/CAMPO_PRO_DEPLOYMENT.md).

A fila offline conserva o vínculo com a conta e organização; mudar de espaço impede enviar coletas ao catálogo errado. Exportações e backups incluem apenas o espaço ativo. Contas, equipe e auditoria exigem backup operacional do Supabase.
