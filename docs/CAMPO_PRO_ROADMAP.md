# Campo Pro — Roadmap de Evolução

## Objetivo

Evoluir o **Campo · Catálogo** de uma ferramenta pessoal para uma plataforma de campo utilizável por profissionais, consultorias, pesquisadores e pequenos times ambientais.

A ideia não é reconstruir o projeto nem remover o que já funciona. O objetivo é aproveitar a base existente e adicionar uma camada profissional e comercial.

---

## 1. O que deve permanecer

Manter como núcleo do projeto:

- Registro de observações de plantas e fungos.
- Fotos associadas às observações.
- Coordenadas, altitude, habitat, substrato, vegetação e notas.
- Histórico de identificação.
- Pl@ntNet para identificação de plantas.
- GBIF, iNaturalist, speciesLink e Flora e Funga do Brasil.
- Mapa com MapLibre/OpenStreetMap.
- Funcionamento como PWA.
- Captura offline.
- Biblioteca pessoal.
- Caderno.
- Europe PMC.
- PubChem.
- LOTUS.
- Sistema de evidências.
- Exportação e backup.
- SQLite para uso local.
- PostgreSQL/Supabase para modo hospedado.

Não remover o caráter de **catálogo científico pessoal**.

---

# 2. Mudança principal de conceito

Hoje o sistema é principalmente:

> catálogo pessoal de observações e pesquisa.

Adicionar um novo conceito:

> projeto de campo.

Estrutura sugerida:

```text
Organização
└── Projeto
    ├── Campanhas
    │   └── Observações
    ├── Locais / Pontos
    ├── Espécies
    ├── Membros
    ├── Arquivos
    └── Relatórios
```

Exemplo:

```text
Consultoria Serra Verde

Projeto:
Inventário de Flora — Canela

Campanha:
Primavera 2026

Observações:
CAMPO-000143
CAMPO-000144
CAMPO-000145
```

A observação continua sendo praticamente a mesma entidade atual.

---

# 3. Prioridade máxima — Projetos

Adicionar uma área **Projetos**.

Cada projeto deve possuir:

- nome;
- descrição;
- cliente opcional;
- responsável;
- data inicial;
- data final opcional;
- município/região;
- coordenadas ou área de interesse;
- status;
- etiquetas;
- observações;
- membros;
- campanhas;
- registros relacionados.

Uma observação pode:

- pertencer a um projeto;
- pertencer a uma campanha;
- continuar existindo sem projeto no modo pessoal.

Não quebrar registros antigos.

---

# 4. Campanhas de campo

Dentro de um projeto, permitir criar campanhas.

Exemplo:

```text
Projeto: Inventário Mata Atlântica

Campanhas:

- Outono 2026
- Inverno 2026
- Primavera 2026
```

Campos:

- nome;
- data;
- equipe;
- área;
- objetivo;
- condições do campo;
- notas.

Isso permite organizar levantamentos reais sem transformar cada observação em um registro isolado.

---

# 5. Modo Pessoal e Modo Profissional

Separar a interface em dois contextos.

## Pessoal

Manter:

- catálogo;
- biblioteca;
- compostos;
- LOTUS;
- PubChem;
- Europe PMC;
- caderno;
- pesquisas pessoais.

## Campo / Profissional

Adicionar:

- projetos;
- campanhas;
- equipe;
- mapa;
- formulários;
- relatórios;
- exportações.

Não duplicar dados.

A mesma observação deve poder aparecer no catálogo pessoal e dentro de um projeto.

---

# 6. Autenticação real

O sistema atual utiliza uma senha compartilhada.

Para a versão profissional, implementar autenticação por usuário.

Sugestão:

- Supabase Auth.

Login:

- e-mail + senha;
- magic link opcional.

Futuramente:

- Google.

Não implementar autenticação própria.

---

# 7. Organizações

Adicionar conceito de organização.

Exemplo:

```text
Usuário
  ↓
Organização
  ↓
Projetos
```

Um usuário pode participar de mais de uma organização.

Papéis iniciais:

```text
owner
admin
member
viewer
```

Permissões básicas:

### owner

Controle total.

### admin

Gerencia projetos e equipe.

### member

Cria e edita registros.

### viewer

Somente leitura.

Evitar sistema de permissões excessivamente complexo.

---

# 8. Isolamento de dados

Ao ativar organizações, todo dado profissional deve pertencer a:

```text
organization_id
```

Projetos:

```text
organization_id
```

Observações profissionais:

```text
organization_id
project_id
campaign_id
```

Aplicar RLS no Supabase.

Nenhuma organização pode acessar registros de outra.

---

# 9. Formulários de campo configuráveis

Uma das funcionalidades com maior potencial comercial.

Permitir que cada projeto defina campos extras.

Tipos iniciais:

- texto;
- número;
- seleção;
- múltipla seleção;
- verdadeiro/falso;
- data;
- coordenada;
- observação.

Exemplo:

```text
DAP:
[ 32.4 cm ]

Altura estimada:
[ 8 m ]

Fenologia:
[x] Flor
[ ] Fruto

Estado:
[ Adulto ]
```

Não criar um construtor visual complexo inicialmente.

Uma tela simples para adicionar campos é suficiente.

---

# 10. Melhorar funcionamento offline

Hoje o offline funciona principalmente como rascunho.

A versão profissional deve evoluir para:

```text
Campo
↓
dados ficam localmente
↓
sem internet
↓
usuário continua trabalhando
↓
conexão retorna
↓
sincronização
```

Usar:

- IndexedDB;
- fila local de alterações;
- status de sincronização.

Estados:

```text
salvo localmente
aguardando sincronização
sincronizado
erro
```

Não tentar sincronização colaborativa complexa inicialmente.

---

# 11. Modo de coleta rápida

Criar uma tela específica para campo.

Objetivo:

registrar uma nova observação em poucos segundos.

Fluxo:

```text
Nova observação

↓ foto

↓ GPS automático

↓ grupo

↓ identificação opcional

↓ campos principais

↓ salvar
```

Evitar navegação pesada.

Botões grandes e interface adequada para celular.

---

# 12. Pontos e áreas de amostragem

Permitir criar:

- pontos;
- trilhas;
- parcelas;
- áreas.

Tipos iniciais:

```text
point
line
polygon
```

Representação:

```text
GeoJSON
```

Usar MapLibre.

Uma observação pode estar relacionada a um ponto ou parcela.

---

# 13. Importação de GeoJSON

Permitir importar:

```text
.geojson
```

Depois:

- mostrar áreas no mapa;
- associar observações;
- usar em projetos.

Futuramente considerar:

- KML;
- GPX.

Não implementar todos inicialmente.

---

# 14. Exportações profissionais

Manter os formatos atuais e adicionar exportações por projeto.

Formatos prioritários:

```text
CSV
JSON
GeoJSON
ZIP
```

Exportação por:

- projeto;
- campanha;
- período;
- espécie;
- área.

GeoJSON deve incluir:

- coordenadas;
- espécie;
- data;
- código da observação;
- projeto;
- propriedades básicas.

---

# 15. Relatórios

Adicionar gerador simples de relatório.

Não tentar criar um sistema de relatórios completo inicialmente.

Primeira versão:

```text
Relatório do projeto

Nome
Local
Período
Equipe
Número de observações
Número de espécies
Mapa
Lista de espécies
Registros
Fotos selecionadas
```

Saídas:

```text
PDF
CSV
```

Permitir selecionar quais seções incluir.

---

# 16. Dashboard do projeto

Cada projeto deve possuir uma visão geral.

Mostrar:

```text
Observações
Espécies
Campanhas
Últimos registros
Mapa
Período
Membros
```

Adicionar alguns indicadores:

```text
total de observações
total de espécies
observações pendentes de identificação
observações confirmadas
```

Evitar dashboard excessivamente complexo.

---

# 17. Qualidade dos registros

Criar um indicador de completude.

Exemplo:

```text
Registro completo

✓ foto
✓ coordenada
✓ data
✓ habitat
✓ identificação
```

Não criar um score científico de confiabilidade.

Apenas mostrar campos ausentes.

---

# 18. Identificação

Manter o princípio atual:

> identificação automática é sugestão.

Adicionar status claros:

```text
não identificado
sugestão automática
identificação provável
identificado pelo usuário
confirmado externamente
```

Permitir filtrar registros por status.

---

# 19. Fungos

Não tentar criar imediatamente um modelo próprio de identificação visual.

Manter:

- morfologia;
- localização;
- época;
- substrato;
- ocorrências próximas;
- comparação contextual.

Melhoria interessante:

criar um **checklist morfológico guiado**.

Exemplo:

```text
Chapéu
Cor
Formato
Diâmetro

Lamelas
Cor
Inserção

Estipe
Comprimento
Anel
Volva

Esporada

Substrato

Odor

Mudança de cor
```

Isso aumenta o valor do catálogo sem depender de IA.

---

# 20. Fotografias

Adicionar posteriormente:

- adicionar fotos depois da criação;
- escolher foto principal;
- legenda;
- tipo da foto;
- ordenar fotos.

Tipos:

```text
habitat
planta inteira
folha
flor
fruto
casca
chapéu
lamelas
estipe
substrato
outro
```

---

# 21. Pesquisa científica

Manter Europe PMC, PubChem e LOTUS.

Mas separar visualmente:

```text
Campo
Pesquisa
```

Não deixar módulos químicos dominarem a experiência de profissionais ambientais.

Esses recursos são um diferencial do Campo, mas não precisam ser o principal argumento comercial.

---

# 22. Compostos e produtos naturais

Manter o sistema atual baseado em evidência.

Não adicionar:

- doses;
- recomendações de consumo;
- inferências automáticas de efeito.

Melhorias possíveis:

- classificar tipo de estudo;
- tecido/parte estudada;
- método analítico;
- localização da amostra;
- concentração;
- referência;
- DOI;
- PMID.

---

# 23. Biblioteca

Transformar a biblioteca atual em uma estrutura expansível.

Permitir:

```text
Favoritar espécie
Adicionar nota
Relacionar observação
Relacionar publicação
Relacionar composto
```

Não transformar inicialmente em uma enciclopédia pública.

---

# 24. Busca

Antes de aumentar muito o número de usuários/dados:

mover parte da busca para o banco.

Hoje o catálogo carregado no navegador funciona para uso pessoal.

Para grandes projetos implementar:

- paginação;
- índices PostgreSQL;
- busca por nome;
- família;
- gênero;
- projeto;
- data;
- localização.

PostgreSQL inicialmente é suficiente.

Não adicionar Elasticsearch.

---

# 25. Auditoria

Para uso profissional, registrar:

```text
quem criou
quem modificou
quando criou
quando modificou
```

Para alterações importantes:

```text
before
after
user
timestamp
```

Priorizar:

- identificação;
- coordenadas;
- espécie;
- projeto;
- exclusão.

---

# 26. Comentários

Posteriormente permitir comentários internos em uma observação.

Exemplo:

```text
@igor conferir identificação.

Provavelmente Baccharis sp.
```

Não criar chat completo.

---

# 27. Compartilhamento

Criar futuramente links de leitura.

Exemplo:

```text
campo.app/share/abc123
```

Permitir compartilhar:

- observação;
- projeto;
- relatório.

Configurações:

```text
privado
link somente leitura
```

Não deixar observações públicas por padrão.

---

# 28. Modelo comercial

Não implementar cobrança imediatamente.

Primeiro validar usuários.

Estrutura futura possível:

## Free

- uso pessoal;
- catálogo;
- número limitado de projetos.

## Pro

- projetos;
- relatórios;
- exportações;
- armazenamento maior.

## Team

- organização;
- membros;
- permissões;
- colaboração.

Evitar decidir preços antes de conversar com usuários reais.

---

# 29. O que NÃO implementar agora

Evitar:

- rede social;
- feed público;
- marketplace;
- chat;
- fórum;
- sistema complexo de permissões;
- IA generativa em todas as telas;
- modelo próprio de visão computacional;
- blockchain;
- aplicativo mobile nativo;
- dezenas de formatos de exportação;
- integração com dezenas de APIs;
- sistema completo de billing;
- dashboards complexos.

O produto já possui muitas funcionalidades.

A prioridade agora deve ser transformar as funcionalidades existentes em um fluxo profissional simples.

---

# 30. Nova navegação sugerida

```text
Início

Campo
├── Projetos
├── Campanhas
├── Observações
└── Mapa

Catálogo
├── Espécies
├── Fungos
└── Biblioteca

Pesquisa
├── Descobertas
├── Publicações
├── Compostos
├── LOTUS
└── Evidências

Caderno

Dados
├── Importar
├── Exportar
└── Backup

Configurações
```

---

# 31. Ordem de implementação

## Fase 1 — Estrutura profissional

Implementar primeiro:

1. projetos;
2. campanhas;
3. relacionar observações a projetos;
4. dashboard de projeto;
5. exportação por projeto.

Não alterar autenticação ainda se isso atrasar validação.

---

## Fase 2 — Campo

6. modo de coleta rápida;
7. melhoria offline;
8. pontos/parcelas;
9. GeoJSON;
10. formulários configuráveis.

---

## Fase 3 — Multiusuário

11. Supabase Auth;
12. organizações;
13. membros;
14. permissões;
15. RLS;
16. auditoria.

---

## Fase 4 — Produto comercial

17. relatórios;
18. compartilhamento;
19. limites por plano;
20. cobrança.

Somente iniciar esta fase depois de validar interesse real.

---

# 32. MVP profissional recomendado

Não implementar todo este documento de uma vez.

O primeiro MVP comercial deve possuir apenas:

```text
Projetos
Campanhas
Observações
Fotos
GPS
Mapa
Identificação
Modo de coleta rápida
Exportação CSV
Exportação GeoJSON
Relatório simples
```

Todo o restante do Campo pode continuar disponível, mas não precisa fazer parte da proposta comercial inicial.

---

# 33. Validação antes de expandir

Antes de desenvolver a parte multiusuário completa:

mostrar o produto para pelo menos:

```text
3 biólogos
3 profissionais ambientais
3 consultorias pequenas
```

Perguntar:

```text
Como vocês registram dados hoje?

O que usam em campo?

O que mais toma tempo?

Como organizam fotografias?

Como fazem relatórios?

Como exportam os dados?

O que precisam refazer manualmente?

Que parte deste sistema vocês usariam?

Pagariam para resolver qual desses problemas?
```

Não perguntar apenas:

> Você usaria este aplicativo?

Observar problemas reais.

---

# 34. Princípio do projeto

A direção do Campo deve ser:

> primeiro uma excelente ferramenta de campo; depois um SaaS.

Não transformar o projeto em um sistema corporativo gigante antes de descobrir quem realmente precisa dele.

A vantagem do Campo é unir:

```text
observação de campo
+
identificação
+
geografia
+
documentação
+
evidência científica
+
pesquisa de produtos naturais
```

Preservar essa identidade.

---

# Resultado esperado

O Campo deve conseguir servir simultaneamente como:

### Para o usuário individual

Um catálogo pessoal avançado de natureza e pesquisa.

### Para o profissional

Uma ferramenta para organizar trabalho de campo.

### Para uma equipe

Uma plataforma para compartilhar projetos e registros.

### Para o negócio

Um produto que possa futuramente ser vendido por assinatura sem precisar reconstruir sua base.
