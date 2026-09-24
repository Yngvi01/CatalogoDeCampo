# Campo · Catálogo

Aplicação web pessoal para explorar substâncias relatadas em plantas, examinar as fontes dessas relações e registrar plantas e fungos observados em campo. Permite comparar possíveis identificações e preservar observações, fotografias e evidências científicas. Interface em português, escura, responsiva, sem cadastro em serviços externos para usar o catálogo.

## Executar

Requisitos: Node.js 22.13+ (testado com 24), pnpm 10 e Linux. No Fedora, caso não exista binário nativo de `better-sqlite3` para a combinação instalada, a compilação exige Python, make e compilador C++.

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Abra a URL exibida no terminal; por padrão, `http://127.0.0.1:3000`. Se a porta estiver ocupada, o servidor de desenvolvimento escolhe outra. O banco e as migrations são preparados automaticamente. Nenhuma observação fictícia é inserida.

Para uso diário:

```bash
pnpm build
pnpm start
```

Para escolher a porta: `PORT=3001 pnpm start`.

## Celular na rede local

1. Defina `CAMPO_PASSWORD` em `.env.local`.
2. Execute `pnpm dev:lan` ou, após compilar, `pnpm start:lan`.
3. No celular conectado à mesma rede, abra `http://IP-DO-COMPUTADOR:3000` (ou a porta exibida).
4. Se o firewall do Fedora bloquear a conexão, permita a porta apenas na zona da sua rede confiável. Não é necessário abrir portas no roteador.

Os comandos padrão escutam somente em `127.0.0.1`. Os comandos `:lan` exigem senha e escutam em `0.0.0.0`. Use os scripts do projeto para manter essa proteção. A sessão dura sete dias; trocar a senha invalida as sessões anteriores.

**PWA e localização no celular exigem HTTPS confiável.** `localhost` no próprio computador é uma exceção dos navegadores. HTTP pelo IP da rede permite consultar o catálogo e enviar fotos, mas pode bloquear geolocalização e instalação da PWA. Para essas funções, coloque um proxy HTTPS local com certificado confiável pelo celular na frente do servidor. A seleção de câmera depende do navegador e do sistema operacional. Coordenadas também podem ser informadas manualmente.

Não há sincronização offline nesta versão. O service worker oferece uma tela de indisponibilidade e não guarda o catálogo privado em cache. O computador precisa estar ligado para consultar e salvar observações pelo celular.

## Configuração

### Vercel + Supabase

O modo `CAMPO_STORAGE=supabase` usa PostgreSQL e um bucket privado no Supabase, sem gravar dados no disco da Vercel. O modo `local` mantém SQLite e fotos em `CAMPO_DATA_DIR`.

1. Crie um projeto Supabase, vincule com `supabase link --project-ref SEU_REF` e aplique `supabase db push`. As migrations estão em `supabase/migrations`; tabelas têm RLS habilitada e acesso público bloqueado.
2. Crie o bucket privado `campo-private`, com limite de arquivo de 50 MB.
3. Na Vercel configure `CAMPO_STORAGE=supabase`, `DATABASE_URL` (Transaction pooler, porta 6543), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET=campo-private` e `CAMPO_PASSWORD`. Preserve as chaves opcionais dos provedores.
4. Faça um novo deploy. Nunca use prefixo `NEXT_PUBLIC_` nas credenciais. A senha é obrigatória no modo hospedado.

Somente as fotos escolhidas após a identificação são enviadas ao bucket por links temporários, e o servidor valida tamanho, formato e conteúdo antes de salvar a observação. Downloads usam links de cinco minutos. JSON, CSV e ZIP também passam pelo Storage para evitar o limite de resposta da Vercel. Na nuvem, cada foto pode ter até 20 MB, o conjunto até 100 MB e a importação/arquivo de backup até 50 MB. Localmente, a importação continua aceitando até 256 MB. ZIPs da nuvem contêm JSON, fotos e checksums; o arquivo SQLite só é incluído em backups locais. Ambos são importáveis nos dois modos.

Antes de atualizar ou restaurar dados por importação, o sistema preserva um ZIP em `backups/` no bucket (ou `data/backups` no modo local). Os dados locais não são enviados automaticamente: use o ZIP para transferir o catálogo. Nenhuma migration SQLite deve ser executada no Supabase.

Para outra hospedagem com disco persistente, use o modo local, HTTPS e senha. `/tmp` não serve como armazenamento definitivo. Consulte os Runtime Logs da Vercel se a API informar falha de conexão ou configuração.

| Variável | Uso |
| --- | --- |
| `CAMPO_STORAGE` | `local` ou `supabase` |
| `DATABASE_URL` | Conexão PostgreSQL do Supabase, somente servidor |
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave privada para o Storage, somente servidor |
| `SUPABASE_STORAGE_BUCKET` | Bucket privado, padrão `campo-private` |
| `CAMPO_DATA_DIR` | Diretório persistente; padrão `./data` |
| `CAMPO_PASSWORD` | Senha de acesso, obrigatória nos scripts de rede local |
| `PLANTNET_API_KEY` | Chave opcional do Pl@ntNet; somente no servidor |
| `SPECIESLINK_API_KEY` | Chave opcional da API do CRIA; somente no servidor |
| `PORT` | Porta do servidor |

Chaves, `.env` e senha não são exportados. Não use prefixo `NEXT_PUBLIC_` para credenciais. Com as duas chaves ausentes, observações, identificação manual, catálogo, mapas, GBIF, iNaturalist, Flora e Funga via GBIF e literatura continuam disponíveis.

## Fluxo principal

- **Identificar:** selecione até cinco fotos e consulte primeiro. As cópias reduzidas passam apenas pela memória do servidor até o provedor; nada é salvo no catálogo ou no Storage durante essa consulta. Depois do resultado, escolha quais originais guardar ou salve a observação sem fotos. Nenhuma imagem vem pré-selecionada; descartar a consulta não cria registros.
- Consulte Pl@ntNet para plantas ou os candidatos contextuais para fungos. A observação pode continuar pendente.
- Compare fontes e registre uma identificação provável, identificada pelo usuário ou confirmada externamente. A última opção exige uma justificativa/fonte.
- **Catálogo:** acompanhe a ficha da espécie e seus diferentes encontros. Registre dados pessoais e evidências, com origem e tipo claramente separados.
- **Campo:** veja observações com coordenadas no mapa e abra o registro pela lista ou marcador.
- **Meu caderno:** escreva páginas com título, texto e etiquetas, releia pelo índice, exporte em TXT ou arquive para consultar depois.
- **Biblioteca:** consulte dez fichas de plantas documentadas no Rio Grande do Sul, incluindo duas visões gerais de gêneros. Cada ficha distingue composição, uso tradicional e segurança, indica a parte estudada quando conhecida e liga as afirmações às fontes. As fotos locais incluem crédito e licença do Wikimedia Commons; nos gêneros, a espécie retratada é identificada. A biblioteca é informativa e não altera o catálogo pessoal nem valida consumo por fotografia.
- **Pesquisa → Descobertas:** investigue uma espécie ou pesquise publicações que mencionem a espécie junto de um composto na Europe PMC. Revise descobertas antes de incorporar evidências. Em **Compostos**, busque no PubChem pelo nome, escolha o CID e salve fórmula e metadados químicos; vincule a espécie somente com evidência e fonte revisadas.
- **Pesquisa → Explorar substâncias:** consulte o LOTUS por nome científico para ver compostos relatados ou por nome de composto para ver táxons relacionados. Cada relação mostra as referências disponíveis. O filtro do RS abrange somente as espécies com ficha na biblioteca, não toda a flora gaúcha. Filtros de efeito usam apenas anotações locais, separadas dos dados do LOTUS.
- **Dados e backup:** exporte o ZIP completo regularmente.

A busca global ignora acentos e caixa e abrange nomes, família, gênero, região, habitat, substrato, morfologia, propriedades, compostos, classes e alvos. Há filtros de grupo, status, período, propriedade, evidência e distância da localização atual. O catálogo é carregado em memória no navegador, adequado ao uso pessoal; paginação e índices de busca são evoluções para volumes maiores.

## Fotografias

Até 12 fotos por observação, 20 MB por foto e 100 MB por envio. JPEG, PNG, WebP, TIFF e HEIF quando suportado pelo build local do Sharp. JPEG/PNG são as opções mais portáveis para fotografias de celular. Conteúdo é decodificado antes de ser aceito, com limite de 60 megapixels.

O arquivo original é preservado, incluindo seus metadados; uma cópia orientada e otimizada de até 1800 px e uma miniatura de até 520 px são geradas sem EXIF/GPS. Apenas as cópias otimizadas são enviadas ao Pl@ntNet. SHA-256 detecta fotos repetidas e apresenta um aviso, sem descartar silenciosamente o registro.

A consulta ao Pl@ntNet usa as primeiras cinco fotos e detecção automática do órgão. Candidatos, score original, referências fotográficas disponíveis, fotos utilizadas, data e resposta são preservados. Alterações de status ficam em histórico. Scores nunca confirmam uma identificação.

## Fontes e limites de interpretação

| Provider | Implementação |
| --- | --- |
| Pl@ntNet | Identificação visual de plantas; chave opcional; cache de 30 dias |
| GBIF | Taxonomia, ocorrências no Brasil ou caixa de ±0,25° e contagem no mês da observação |
| Flora e Funga do Brasil | Lista oficial publicada pelo JBRJ no GBIF, com correspondência exata, sinônimos e distribuição; sem scraping do Reflora |
| iNaturalist | Táxons e ocorrências com grau de pesquisa no Brasil ou raio de 25 km, incluindo contagem no mês |
| speciesLink | API v1.0 do CRIA quando configurada; sem chave, link para consulta no portal |
| Europe PMC | Até 40 artigos por consulta, pesquisando nome aceito e até sete sinônimos com os temas científicos definidos |
| PubChem | Busca de compostos por nome via PUG REST; CID, fórmula, massa molecular e InChIKey com cache de sete dias; não exige chave |
| LOTUS | Relações entre produtos naturais e táxons vegetais com referências; consulta iniciada pelo usuário, cache compacto de 14 dias e limite de resposta |
| Fungos | Histórico pessoal por contexto/morfologia e, com coordenadas, até oito espécies registradas no iNaturalist a 25 km no mesmo mês |

Providers separados implementam `IdentificationProvider`, `TaxonomyProvider`, `OccurrenceProvider` e `LiteratureProvider`. O cache persistente usa provider, parâmetros, consulta, resposta, criação e validade. As demais consultas têm validade de um dia. Atualizações manuais estão disponíveis na comparação, identificação e pesquisa.

**Fungos:** não há classificação visual automática nem modelo generativo. A correspondência morfológica local compara campos preenchidos; o histórico exige pelo menos dois critérios em comum. Os registros do iNaturalist são candidatos geográficos, sem inferência de compatibilidade visual ou de comestibilidade. A interface mostra critérios e fontes. Um modelo local futuro pode implementar a mesma interface.

**Comparação:** cada candidato pode ser consultado separadamente. Ocorrências geográficas, sazonalidade e taxonomia são apresentadas sem fundir scores. A caixa GBIF/speciesLink e o raio iNaturalist são diferentes e identificados na interface. Ausência de registros não prova ausência biológica. Compatibilidade diagnóstica de habitat e morfologia exige revisão humana; não há uma porcentagem agregada ou confirmação automática.

**Literatura:** resultados nunca alteram a ficha automaticamente. Incorporar exige escrever a afirmação e escolher seu tipo de evidência. Parte da planta/fungo, concentração, unidade, intervalo, método e origem da amostra ficam na relação espécie–composto, com fonte. As informações textuais do composto são anotações; suas referências são vinculadas nas evidências das espécies. Não são geradas doses nem recomendações de consumo.

**PubChem:** a seleção de um resultado preenche nome e fórmula e salva seu CID no composto; classe, mecanismos, efeitos e toxicologia continuam editáveis e não são inferidos automaticamente. O PubChem identifica a substância, mas não demonstra que ela ocorre numa espécie ou em determinada parte da planta. A lista de compostos mostra separadamente as evidências vinculadas às espécies, com suas fontes. A consulta passa pelo servidor autenticado e usa cache para reduzir chamadas externas.

**LOTUS:** os resultados externos permanecem na exploração até revisão; não criam automaticamente compostos, evidências ou espécies no catálogo. A busca por espécie exige correspondência exata nos táxons associados às referências; buscas `spp.` permanecem identificadas como buscas de gênero. A API pode retornar muitos dados ou demorar para táxons amplos; nesses casos a interface informa a falha e oferece consulta direta à fonte. Parte analisada, método e concentração não vêm dessa busca e precisam ser verificados nas publicações.

**Privacidade:** no modo local, os dados ficam no computador. No modo Supabase, registros e fotos ficam no projeto Supabase e são acessados pelo servidor Vercel autenticado. Consultas iniciadas pelo usuário enviam nomes científicos e, quando necessário, coordenadas aos respectivos providers. Abrir o mapa carrega tiles do OpenStreetMap. O Pl@ntNet recebe fotos apenas quando acionado. Originais podem conter EXIF; ficam no armazenamento configurado (disco local ou bucket privado) e no backup completo.

## Backup e transferência

JSON contém `format: "campo-catalogo"`, `version: 2`, `exportedAt` e `data`, com espécies, observações, imagens (metadados), identificações, histórico, compostos, evidências/propriedades/referências, descobertas, pesquisas, páginas do caderno (incluindo arquivadas) e preferências permitidas. JSON **não inclui arquivos de imagem**. CSV é oferecido para espécies, observações e compostos, com neutralização de fórmulas de planilha.

ZIP completo:

```text
campo-backup.zip
├── manifest.json       # versões, data, contagens e checksums SHA-256
├── database.sqlite     # snapshot consistente, incluindo cache local
├── export.json         # dados portáveis e validados
└── images/             # originais, otimizadas e miniaturas
```

A importação valida versão, schema, IDs, códigos, relações, checksums, presença de fotos e caminhos antes de apresentar a prévia. Limites: arquivo de até 256 MB, expansão do ZIP de até 1 GB e 20 mil entradas. O ZIP é processado em memória; para catálogos maiores será necessário evoluir para streaming.

- **Ignorar existente:** preserva registros de mesmo ID e adiciona IDs novos.
- **Atualizar:** sobrescreve IDs existentes e salva um backup anterior.
- **Importar como novo:** cria novos IDs, códigos e relações; é uma duplicação deliberada.
- **Restaurar completamente:** substitui os dados do catálogo pelos do ZIP, preservando IDs e relações; cria antes um ZIP em `data/backups/`.

Conflitos de código CAMPO entre IDs diferentes são bloqueados em mesclagens. O arquivo precisa ser o mesmo que foi pré-visualizado. Dados são gravados em transação; novos arquivos são revertidos quando a transação falha. Imagens existentes nunca são sobrescritas: divergências recebem novos nomes. Arquivos antigos não referenciados são mantidos, evitando apagar fotos durante a restauração.

A restauração reconstrói as tabelas **a partir do JSON versionado** com as migrations atuais; não substitui o arquivo SQLite aberto nem executa SQL de um arquivo enviado. Backups locais também preservam um snapshot SQLite para recuperação independente. Cache externo não é necessário para restaurar o catálogo; identificações permanentes estão no JSON. Restaurações não importam credenciais.

Para transferir: instale o projeto no destino, inicie, abra Dados e backup, selecione o ZIP, valide a prévia e escolha restaurar. Guarde cópias em outro dispositivo; `data/backups/` no mesmo disco não protege contra perda física do computador.

## Arquitetura e evolução

```text
app/                    Next.js, rotas HTTP e layout
components/             Interface compartilhada, Button no padrão shadcn/ui
features/observations/  Registro, edição e histórico
features/identification/Providers e comparação
features/species/       Ficha, observações e evidências
features/research/      Publicações, compostos e revisão
features/notebook/      Caderno, leitura e edição de páginas
features/map/           MapLibre + tiles OpenStreetMap
features/backup/        Exportação e restauração
lib/db/                 Adaptadores SQLite/PostgreSQL e repositório
lib/storage/            Processamento e armazenamento de fotos
lib/validation/         Schemas Zod e limites de leitura HTTP
lib/providers/          Adaptadores independentes e cache
```

O repositório assíncrono usa SQLite com WAL no modo local e PostgreSQL com pool de transações no Supabase. Ambos preservam chaves estrangeiras e documentos validados. Transações PostgreSQL usam um lock compartilhado entre instâncias para numeração e alterações concorrentes. SQLite não deve ser compartilhado entre várias instâncias nem colocado em filesystem de rede.

A entrega reúne o fluxo MVP, fontes externas, pesquisa científica e assistência contextual inicial para fungos. Próximas evoluções: modelo visual local de fungos, pesquisa paginada para grandes catálogos, backup em streaming e criação offline. O sistema continua utilizável sem essas extensões.

## Verificação

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium  # primeira execução, se necessário
pnpm test:e2e
```

Testes de serviço usam banco temporário e verificam registro, EXIF, histórico, conflitos, relações, backup/restauração, corrupção, path traversal, URLs perigosas, CSV e autenticação. O teste de navegador inicia um servidor protegido na porta 3002 com outro banco temporário e percorre login, upload, confirmação, busca sem acentos, evidência, ZIP e tela móvel. Não altera o catálogo pessoal.

## Documentação das integrações

- [Pl@ntNet: identificação](https://my.plantnet.org/doc/api/identify)
- [GBIF: API](https://techdocs.gbif.org/en/openapi/)
- [Flora e Funga: dataset oficial no GBIF](https://www.gbif.org/dataset/aacd816d-662c-49d2-ad1a-97e66e2a2908)
- [iNaturalist: API v1](https://api.inaturalist.org/v1/docs/)
- [speciesLink: API v1.0](https://specieslink.net/ws/1.0/)
- [Europe PMC: serviço REST](https://europepmc.org/RestfulWebService)
- [PubChem: PUG REST](https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest)
- [LOTUS: documentação e API](https://lotus.naturalproducts.net/documentation)

## Reflexões na tela inicial

O bloco **Uma pausa para pensar** exibe frases em inglês do [ZenQuotes](https://docs.zenquotes.io/zenquotes-documentation/), com autor e crédito/link do serviço. Não exige chave nem dependência adicional. A seleção muda aleatoriamente a cada 60 segundos, sem repetição imediata; é possível pausar, retomar ou avançar manualmente. A rotação para quando a aba fica oculta e respeita a preferência por movimento reduzido na transição.

O backend busca um lote de frases e o mantém no cache do banco por 24 horas. Cada troca acontece no navegador, sem nova chamada externa. Em caso de falha, preserva o último lote disponível e aguarda 15 minutos antes de tentar novamente. Sem cache, exibe reflexões originais do Campo, identificadas como tal. O serviço recebe uma consulta genérica do servidor; não recebe fotos, coordenadas ou dados do catálogo. O plano gratuito retorna reflexões gerais, sem promessa de filtro por filosofia ou psicologia.


## Caderno de anotações

Em **Meu caderno**, cada anotação é uma página com título, texto livre, etiquetas e datas de criação/edição. O índice permite alternar páginas em uma leitura semelhante a um livro. A busca do caderno e a busca global nessa área ignoram acentos e maiúsculas, pesquisando títulos, textos e etiquetas.

Use **Salvar página** (ou Ctrl/⌘ S) para gravar no banco configurado. A edição avisa antes de descartar mudanças ao fechar o editor ou sair da página. Não há salvamento automático nem gravação offline: se o envio falhar, mantenha o editor aberto ou copie o texto antes de sair. Alterações concorrentes em outra janela são bloqueadas para não sobrescrever a versão mais recente.

**Arquivar** mantém a página guardada e pesquisável em **Arquivadas**; **Restaurar página** devolve ao caderno. Também é possível baixar cada página como TXT. Não há exclusão definitiva na interface.

O backup passou para o **formato 2** para incluir as páginas, inclusive arquivadas. JSON e ZIP da versão 1 continuam sendo aceitos e são interpretados como sem páginas. Uma restauração completa de um backup antigo esvazia o caderno, como indicado na prévia, mas cria antes um backup automático contendo o estado atual. Use esta versão ou uma mais recente do aplicativo para importar arquivos do formato 2.

### Verificar a integração Supabase

Com variáveis de um projeto de teste configuradas, execute `CAMPO_SUPABASE_TEST=1 node --env-file=SEU_ARQUIVO_PRIVADO --import tsx --test tests/supabase.test.ts`. O teste verifica transações, conflitos, upload assinado, privacidade e backup; remove apenas os registros que criou. A suíte padrão não acessa Supabase.

Uploads abandonados e cópias temporárias de exportação com mais de 24 horas são removidos em lotes nas próximas operações de upload/exportação. Fotos definitivas e backups de recuperação não são removidos por essa rotina.

### Identificar antes de guardar fotos

A consulta inicial usa JPEGs reduzidos no navegador (até 650 KB por foto), com remoção de EXIF também no servidor. Não cria observação, imagens, arquivos temporários no Storage nem cache visual. O Pl@ntNet recebe as cópias para análise; fungos usam assistência contextual, sem análise visual. Os originais permanecem no navegador até a escolha explícita de retenção. Fechar/descartar a consulta não salva nada.

O resultado assinado expira em uma hora. Ao salvar, apenas as fotos selecionadas são transferidas e relacionadas ao registro; também é possível salvar os dados e candidatos com zero imagens. Se a consulta automática falhar, a tela mantém as fotos e permite repetir ou continuar explicitamente com identificação manual. Para este fluxo, use JPEG, PNG ou WebP que o navegador consiga abrir.

### Excluir uma identificação salva

Abra a observação, clique em **Excluir identificação** e confirme **Excluir definitivamente**. A exclusão remove a observação, consultas, histórico e fotos vinculadas. A ficha da espécie, suas pesquisas/evidências e outras observações são preservadas. Arquivos compartilhados por outro registro não são apagados. Backups já exportados não são alterados.

O banco registra a limpeza de arquivos antes de remover o registro. Se o disco ou Storage estiver indisponível, a interface informa a pendência e tenta novamente ao carregar o catálogo. Nenhum registro é excluído apenas ao abrir ou cancelar a confirmação.

### Fotos de natureza (Pexels)

A tela inicial inclui **Janela para a natureza**, com fotos aleatórias de plantas e florestas e o botão **Ver outra paisagem**. Configure `PEXELS_API_KEY` somente no servidor (na Vercel, em Production e Preview). A chave gratuita é obtida em https://www.pexels.com/api/.

O servidor busca até 80 fotos e guarda apenas URLs e créditos no cache por 24 horas. As imagens carregam diretamente do Pexels, sem entrar no catálogo ou no bucket. O sorteio ocorre no navegador, sem nova consulta ao provedor por clique. Em caso de falha, o último lote em cache continua disponível; sem cache, o cartão informa a indisponibilidade. Os créditos do fotógrafo e do Pexels acompanham cada imagem. As frases continuam independentes.

### Fotografar e comparar

Em **Nova observação**, o guia orienta fotos de partes diferentes da mesma planta. Cada foto pode ser marcada como folha, flor, fruto, casca ou automático; essa seleção é enviada ao Pl@ntNet e preservada apenas nas fotos escolhidas para salvar. Após a consulta, compare até três candidatos com nomes, família, gênero, pontuação e referências disponíveis. A comparação também está na observação salva. A pontuação não representa confirmação da espécie. Orientações: https://docs.plantnet.org/en/cookbook/making-a-good-observation/.
