# Campo Pro — andamento

O [roadmap](CAMPO_PRO_ROADMAP.md) orienta a evolução incremental. As entregas cobrem as **Fases 1 e 2** e adicionam o modo opcional da **Fase 3 — Multiusuário**, mantendo o uso local. As contas profissionais foram ativadas na instalação Vercel/Supabase e verificadas com serviços reais em 02/10/2026; veja o [registro da implantação](CAMPO_PRO_DEPLOYMENT.md).

- Projetos: criação, edição, descrição, cliente, responsável, período, região, coordenadas, área de interesse textual, status, etiquetas, membros informativos e notas.
- Campanhas: criação e edição dentro do projeto, data, equipe, área, objetivo, condições e notas.
- Observações: vínculo opcional com projeto/campanha na criação, no rascunho do navegador e na edição de registros existentes. Uma campanha deve pertencer ao projeto escolhido. Remover o vínculo mantém o registro pessoal.
- Visão geral: contagens, espécies registradas, campanhas, equipe, período, registros e mapa. Pendentes incluem não identificados, sugestões automáticas e identificações prováveis; confirmação externa é apresentada separadamente.
- Exportações: CSV, JSON, GeoJSON e ZIP por projeto, com filtros por campanha, período e espécie. GeoJSON contém pontos com coordenadas, código, espécie, data, projeto, campanha e propriedades do registro. ZIP contém apenas dados e fotos do recorte, sem snapshot SQLite de outros projetos.
- Persistência: migrations SQLite e PostgreSQL, índices para relações e validação transacional.
- Backup: formato 4, projetos e campanhas incluídos; importação dos formatos 1 e 2; remapeamento de vínculos ao importar como novo.

As observações continuam no catálogo pessoal, sem duplicação. Espécies são compartilhadas pelo catálogo ativo — da instalação no modo compartilhado ou da organização no modo profissional. Os nomes informativos de equipe nos projetos continuam disponíveis. No modo profissional, as contas e permissões pertencem à organização e são gerenciadas separadamente.

## Fase 2 — Campo entregue

- Coleta rápida em `/collect.html`, acessível pelo projeto ou pela fila no catálogo, com fotos opcionais, GPS automático, grupo, identificação manual opcional, habitat, substrato, notas e campos extras. Salvar mantém projeto/campanha/ponto para a próxima coleta.
- IndexedDB separado para coletas e contexto de campo; a página e seus scripts podem reabrir sem rede após preparação com conexão. A página guarda nomes de projetos/campanhas, locais e definições de formulários no aparelho. O catálogo completo e consultas externas continuam dependentes do servidor.
- Fila com estados salvo localmente, aguardando sincronização, sincronizado e erro. Envios automáticos enquanto a página de coleta ou o catálogo estão abertos e conectados. Reenvios usam o mesmo ID, com transação no servidor para evitar duplicação. Uma consulta de recebimento recupera respostas perdidas antes de reenviar fotos.
- Fotos permanecem na fila até a confirmação do servidor. Depois, o aparelho mantém o resumo sincronizado e libera as cópias locais das fotos. Coletas pendentes não entram no backup do servidor.
- Erros de validação podem ser corrigidos na coleta rápida. Sessão expirada exige entrar novamente e tentar sincronizar. Não há sincronização com o navegador fechado, nem edição colaborativa ou sincronização do catálogo inteiro.
- Pontos, trilhas/linhas e parcelas/áreas com GeoJSON (`Point`, `LineString`, `Polygon`), criação, edição e desativação. Geometrias aparecem no MapLibre e podem ser associadas às observações.
- Importação atômica de GeoJSON: geometria, Feature ou FeatureCollection, até 2 MB e 1.000 features. Coordenadas geográficas na ordem longitude, latitude; polígonos precisam ter anéis fechados. KML, GPX, MultiPolygon e construtor de desenho ficam fora desta fase.
- Formulário simples por projeto: texto, número, seleção, múltipla seleção, verdadeiro/falso, data, coordenada e observação; campos podem ter unidade, obrigatoriedade e desativação. Tipos e opções com valores existentes são protegidos contra alterações incompatíveis. A edição do formulário detecta alterações concorrentes do projeto.
- Campos extras e locais disponíveis no fluxo tradicional e na edição dos registros. Exportações por projeto incluem filtro de ponto/parcela; GeoJSON distingue `observation` de `sampling_site` e inclui as geometrias. JSON/ZIP e importação como novo preservam vínculos e valores.

## Próximas etapas

A Fase 3 adiciona Supabase Auth com sessão em cookies e renovação, organizações com seleção de espaço, convites vinculados a e-mail confirmado, papéis `owner/admin/member/viewer`, isolamento RLS e auditoria com antes/depois. Consultas PostgreSQL assumem o papel `authenticated`, incluindo as feitas pelo servidor. IDs, códigos e relações são isolados por organização. Fotos, uploads e a fila offline também têm vínculo com o espaço.

A instalação anterior fica preservada em uma organização sem membros até atribuição explícita pelo operador. Na instalação publicada, essa atribuição já foi realizada para a conta proprietária, preservando o registro, a espécie e a foto anteriores. O modo SQLite e o Supabase com senha compartilhada continuam disponíveis sem a migration profissional. Veja [ativação, permissões e limitações](CAMPO_PRO_AUTH.md). No código atual, contas profissionais podem se cadastrar pela tela de login após confirmar o e-mail; contas também podem ser criadas no painel Supabase, e convites são compartilhados pelo administrador. A recuperação de senha permanece administrativa. A validação com profissionais prevista pelo roadmap continua pendente; a disponibilidade técnica não representa essa validação.

Relatórios, compartilhamento, planos e cobrança pertencem à Fase 4. O roadmap condiciona essa fase à validação de interesse real; nenhuma validação com profissionais é presumida como concluída.

## Instalação

SQLite aplica as migrations `0006_field_projects` e `0007_field_sampling` ao inicializar o repositório. No Supabase, aplique `supabase/migrations/20261002000100_field_projects.sql` e `supabase/migrations/20261002000200_field_sampling.sql` pelo fluxo de migrations antes de executar a versão atualizada. A aplicação não executa migrations PostgreSQL automaticamente. Para contas e organizações, aplique também a migration profissional seguindo o [guia de ativação](CAMPO_PRO_AUTH.md); depois dela, o banco exige `CAMPO_AUTH=supabase`.

Use esta versão ou uma mais recente para importar o backup 4. Uma restauração completa sempre substitui todo o catálogo ativo pelo conteúdo do arquivo, inclusive quando o ZIP contém apenas um projeto. Para adicionar um projeto exportado a um catálogo existente, prefira as estratégias de mesclagem e revise a prévia.
