# Campo · Catálogo

Aplicação web pessoal para registrar plantas e fungos, comparar possíveis identificações e preservar observações, fotografias e fontes científicas. Interface em português, escura, responsiva, sem cadastro em serviços externos para usar o catálogo.

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

| Variável | Uso |
| --- | --- |
| `CAMPO_DATA_DIR` | Diretório persistente; padrão `./data` |
| `CAMPO_PASSWORD` | Senha de acesso, obrigatória nos scripts de rede local |
| `PLANTNET_API_KEY` | Chave opcional do Pl@ntNet; somente no servidor |
| `SPECIESLINK_API_KEY` | Chave opcional da API do CRIA; somente no servidor |
| `PORT` | Porta do servidor |

Chaves, `.env` e senha não são exportados. Não use prefixo `NEXT_PUBLIC_` para credenciais. Com as duas chaves ausentes, observações, identificação manual, catálogo, mapas, GBIF, iNaturalist, Flora e Funga via GBIF e literatura continuam disponíveis.

## Fluxo principal

- **Identificar:** crie uma observação com uma ou mais fotos. Data e hora são automáticas; localização, ambiente e notas são opcionais.
- Consulte Pl@ntNet para plantas ou os candidatos contextuais para fungos. A observação pode continuar pendente.
- Compare fontes e registre uma identificação provável, identificada pelo usuário ou confirmada externamente. A última opção exige uma justificativa/fonte.
- **Catálogo:** acompanhe a ficha da espécie e seus diferentes encontros. Registre dados pessoais e evidências, com origem e tipo claramente separados.
- **Campo:** veja observações com coordenadas no mapa e abra o registro pela lista ou marcador.
- **Pesquisa:** investigue uma espécie na Europe PMC, revise descobertas, cadastre compostos e incorpore evidências deliberadamente.
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
| Fungos | Histórico pessoal por contexto/morfologia e, com coordenadas, até oito espécies registradas no iNaturalist a 25 km no mesmo mês |

Providers separados implementam `IdentificationProvider`, `TaxonomyProvider`, `OccurrenceProvider` e `LiteratureProvider`. O cache persistente usa provider, parâmetros, consulta, resposta, criação e validade. As demais consultas têm validade de um dia. Atualizações manuais estão disponíveis na comparação, identificação e pesquisa.

**Fungos:** não há classificação visual automática nem modelo generativo. A correspondência morfológica local compara campos preenchidos; o histórico exige pelo menos dois critérios em comum. Os registros do iNaturalist são candidatos geográficos, sem inferência de compatibilidade visual ou de comestibilidade. A interface mostra critérios e fontes. Um modelo local futuro pode implementar a mesma interface.

**Comparação:** cada candidato pode ser consultado separadamente. Ocorrências geográficas, sazonalidade e taxonomia são apresentadas sem fundir scores. A caixa GBIF/speciesLink e o raio iNaturalist são diferentes e identificados na interface. Ausência de registros não prova ausência biológica. Compatibilidade diagnóstica de habitat e morfologia exige revisão humana; não há uma porcentagem agregada ou confirmação automática.

**Literatura:** resultados nunca alteram a ficha automaticamente. Incorporar exige escrever a afirmação e escolher seu tipo de evidência. Parte da planta/fungo, concentração, unidade, intervalo, método e origem da amostra ficam na relação espécie–composto, com fonte. As informações textuais do composto são anotações; suas referências são vinculadas nas evidências das espécies. Não são geradas doses nem recomendações de consumo.

**Privacidade:** os dados permanecem locais. Consultas iniciadas pelo usuário enviam nomes científicos e, quando necessário, coordenadas aos respectivos providers. Abrir o mapa carrega tiles do OpenStreetMap. As fotos são enviadas externamente apenas ao acionar Pl@ntNet. Original com EXIF fica no seu computador e no backup completo.

## Backup e transferência

JSON contém `format: "campo-catalogo"`, `version: 1`, `exportedAt` e `data`, com espécies, observações, imagens (metadados), identificações, histórico, compostos, evidências/propriedades/referências, descobertas, pesquisas e preferências permitidas. JSON **não inclui arquivos de imagem**. CSV é oferecido para espécies, observações e compostos, com neutralização de fórmulas de planilha.

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

A restauração reconstrói as tabelas **a partir do JSON versionado** com as migrations atuais; não substitui o arquivo SQLite aberto nem executa SQL de um arquivo enviado. O snapshot SQLite é preservado no ZIP para recuperação independente. Cache externo não é necessário para restaurar o catálogo; identificações permanentes estão no JSON. Restaurações não importam credenciais.

Para transferir: instale o projeto no destino, inicie, abra Dados e backup, selecione o ZIP, valide a prévia e escolha restaurar. Guarde cópias em outro dispositivo; `data/backups/` no mesmo disco não protege contra perda física do computador.

## Arquitetura e evolução

```text
app/                    Next.js, rotas HTTP e layout
components/             Interface compartilhada, Button no padrão shadcn/ui
features/observations/  Registro, edição e histórico
features/identification/Providers e comparação
features/species/       Ficha, observações e evidências
features/research/      Publicações, compostos e revisão
features/map/           MapLibre + tiles OpenStreetMap
features/backup/        Exportação e restauração
lib/db/                 Drizzle, SQLite, migrations e repositório
lib/storage/            Processamento e armazenamento de fotos
lib/validation/         Schemas Zod e limites de leitura HTTP
lib/providers/          Adaptadores independentes e cache
```

Banco SQLite com WAL, foreign keys e transações. Relações essenciais são colunas com chaves estrangeiras; documentos tipados e validados ficam em colunas JSON. A interface de repositório centraliza acesso ao SQLite. Migrar para PostgreSQL exige adaptar esse repositório/driver e gerar migrations; não é uma troca automática de URL. O SQLite não deve ser compartilhado entre várias instâncias nem colocado em filesystem de rede.

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

## Reflexões na tela inicial

O bloco **Uma pausa para pensar** exibe frases em inglês do [ZenQuotes](https://docs.zenquotes.io/zenquotes-documentation/), com autor e crédito/link do serviço. Não exige chave nem dependência adicional. A seleção muda aleatoriamente a cada 60 segundos, sem repetição imediata; é possível pausar, retomar ou avançar manualmente. A rotação para quando a aba fica oculta e respeita a preferência por movimento reduzido na transição.

O backend busca um lote de frases e o mantém no cache SQLite por 24 horas. Cada troca acontece no navegador, sem nova chamada externa. Em caso de falha, preserva o último lote disponível e aguarda 15 minutos antes de tentar novamente. Sem cache, exibe reflexões originais do Campo, identificadas como tal. O serviço recebe uma consulta genérica do servidor; não recebe fotos, coordenadas ou dados do catálogo. O plano gratuito retorna reflexões gerais, sem promessa de filtro por filosofia ou psicologia.
