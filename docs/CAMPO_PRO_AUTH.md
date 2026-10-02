# Contas e organizações — Fase 3

O modo profissional é opcional e utiliza Supabase Auth. O modo local continua com SQLite e senha compartilhada opcional. A migração multiusuário é destinada a instalações PostgreSQL que vão ativar `CAMPO_AUTH=supabase`; depois dela, o banco exige esse modo. Desativar a variável não reabre o banco com a senha compartilhada.

## Ativação

1. Faça backup da instalação e interrompa o servidor antes das migrations. Não execute a migration multiusuário em uma instalação que continuará usando a senha compartilhada.
2. Aplique as migrations Supabase na ordem, incluindo `20261002000300_professional_workspaces.sql`, com o papel de administração do banco. A aplicação não aplica migrations PostgreSQL automaticamente.
3. Configure no servidor:

```dotenv
CAMPO_STORAGE=supabase
CAMPO_AUTH=supabase
DATABASE_URL=<conexão do pooler PostgreSQL>
SUPABASE_URL=<URL do projeto>
SUPABASE_ANON_KEY=<chave anon ou publishable>
SUPABASE_SERVICE_ROLE_KEY=<chave secret/service_role>
SUPABASE_STORAGE_BUCKET=campo-private
```

A conexão PostgreSQL precisa poder executar `SET LOCAL ROLE authenticated` (o usuário `postgres` do Supabase atende a esse requisito). Cada consulta e transação da aplicação assume esse papel e define o usuário verificado pelo Auth e a organização, sem executar consultas do catálogo como `postgres`. O bucket deve permanecer **privado**, sem políticas que concedam leitura ou escrita genérica a `anon`/`authenticated`; acesso às fotos ocorre pelas APIs do Campo e URLs assinadas temporárias.

4. Cadastre as contas pelo painel **Authentication → Users** do Supabase. O login da aplicação usa e-mail e senha; recuperação de senha e criação de contas ficam no fluxo administrativo do Supabase nesta entrega. Contas usadas para aceitar convites precisam de e-mail confirmado. Habilite as proteções e os limites do provedor de Auth conforme a instalação. `CAMPO_PASSWORD` deixa de autenticar o modo profissional.
5. Execute `pnpm build` e reinicie. A primeira entrada cria um espaço pessoal privado quando a conta ainda não tem organizações. No botão com o nome do espaço, crie organizações, selecione o espaço ativo ou aceite convites.

Nenhum usuário recebe automaticamente os registros anteriores. Eles ficam na organização `Catálogo anterior`, sem membros. Para disponibilizar esse catálogo a uma conta confirmada, execute explicitamente, no servidor:

```bash
pnpm exec tsx scripts/assign-legacy-workspace.ts --user=<UUID da conta no Supabase Auth>
```

Esse comando preserva registros e fotos e impede atribuir outro proprietário quando já existe um. Depois, gerencie os demais membros pela interface. As fotos anteriores permanecem no caminho original, exclusivo desse catálogo. Novas organizações usam `organizations/<UUID>/images`, `uploads`, `exports` e `backups` no bucket.

## Equipe e permissões

| Papel | Permissões |
| --- | --- |
| `owner` | Todas as operações; promove proprietários e transfere propriedade. |
| `admin` | Projetos, campanhas, registros, equipe, importações e auditoria; não remove nem promove proprietários. |
| `member` | Cria, edita e remove observações, locais e registros do catálogo; consulta e exporta projetos. |
| `viewer` | Consulta e exporta; não grava dados, nem gerencia equipe. |

Projetos/campanhas são administrados por `owner`/`admin`, tanto na API quanto nas políticas RLS. Importação/restauração na API exige administrador. O banco protege as demais gravações por organização e papel. Convites duram sete dias, são vinculados ao e-mail confirmado e podem ser revogados. A interface gera o link para o administrador compartilhar; a aplicação não envia e-mails. Um convite já aceito não pode ser usado de novo. Ao convidar um membro existente, sua permissão atual é preservada.

Para transferir a propriedade, primeiro promova o novo proprietário e depois altere ou remova o anterior. O banco serializa essas alterações e exige pelo menos um proprietário. Remover uma pessoa revoga seu acesso às próximas consultas, mesmo com uma sessão Auth ainda válida.

IDs, códigos CAMPO, preferências e caches são exclusivos por organização. Relações entre observações, espécies, projetos, campanhas e fotos incluem a organização nas chaves estrangeiras. A seleção de organização no cookie é conferida contra a associação da conta; ela não concede acesso por si só. Requisições de gravação também conferem `X-Campo-Scope`, evitando que um formulário aberto em outra aba seja salvo no espaço errado.

## Auditoria e backup

A auditoria grava autor, horário, operação e valores antes/depois de inserções, edições e remoções. Inclui identificação, espécie, coordenadas, projetos, campanhas, locais, notas, equipe e convites. Os registros e os carimbos de criação/edição são gerados por triggers; alterações revertidas na transação não ficam no histórico. Administradores consultam o histórico na interface, com paginação de 50 eventos. Os tokens/digests dos convites não aparecem no histórico.

Backups/exportações em formato 4 continuam portáteis e incluem somente o catálogo da organização ativa. Contas, membros, convites e auditoria não são exportados nem substituídos por restauração. Para recuperação operacional integral, mantenha também backups do PostgreSQL e do bucket pelo procedimento da sua instalação. Importar em outra organização cria novos carimbos e eventos sob a conta que realizou a importação.

## Offline

Prepare a coleta rápida com conexão dentro da organização correta. O contexto e cada coleta ficam vinculados à conta e organização. Uma troca de conta/espaço impede o envio da fila anterior e conserva as fotos; volte ao espaço original e use **Tentar sincronizar**. Rascunhos tradicionais criados na aplicação também são filtrados pelo espaço. Rascunhos antigos sem vínculo não são importados automaticamente no modo profissional.

Dados e fotos do IndexedDB continuam no aparelho depois de sair da conta. Isso permite retomar coletas pendentes, mas exige usar um aparelho/perfil de navegador apropriado à equipe. A coleta rápida mantém o resumo da fila no mesmo aparelho e informa erros de espaço; não há criptografia local, sincronização com o navegador fechado nem edição colaborativa do catálogo.

## Verificação

`pnpm test` valida os fluxos locais. O teste de RLS usa um PostgreSQL descartável, sem credenciais da instalação:

```bash
CAMPO_RLS_TEST_URL=postgres://postgres:<senha-de-teste>@127.0.0.1:55432/postgres pnpm exec tsx --test tests/workspace-postgres.test.ts
```

O teste cria e remove um banco isolado, instala um pequeno esquema Auth de teste e aplica as migrations reais. Verifica duas organizações, chaves repetidas, relações cruzadas bloqueadas, leitores, convites, revogação, último proprietário, rollback e auditoria. Ele não substitui a validação do login e Storage com um projeto Supabase real configurado.

Referências: [Supabase Auth para SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [políticas RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
