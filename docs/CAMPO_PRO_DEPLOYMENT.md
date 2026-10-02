# Implantação profissional — 02/10/2026

O modo profissional está ativo em [catalogo-de-campo.vercel.app](https://catalogo-de-campo.vercel.app), com Vercel e Supabase. O deploy validado é `dpl_Cf2oLZKquhWRyuorxgBiGMgSr7mx`. `CAMPO_AUTH=supabase` e a chave pública de Auth foram configurados em produção; as credenciais existentes do banco, Storage e provedores foram preservadas.

As migrations `20261002000100_field_projects`, `20261002000200_field_sampling` e `20261002000300_professional_workspaces` foram aplicadas. Antes da alteração, foram feitas cópias do esquema, dados e arquivos do catálogo. O catálogo anterior foi atribuído à conta proprietária, mantendo uma observação, uma espécie e uma foto com seus três arquivos. O identificador reservado desse espaço é aceito na seleção da organização, com verificação de associação à conta.

## Verificação com serviços reais

- Login por senha e verificação de usuário no Supabase Auth; login na aplicação, sessão e logout.
- Bloqueio de leitura anônima e de download direto do bucket por contas autenticadas; uploads e downloads assinados.
- Catálogo anterior, coordenadas e foto preservados; acesso negado a uma conta sem associação.
- Projetos, campanhas, pontos de amostragem, campos extras e fotos criados pela API publicada.
- Reenvio de coleta confirmado sem duplicação; mesmo ID e código usados em duas organizações com registros independentes.
- Convite aceito pela conta com e-mail confirmado; permissões de leitor, membro, administrador e proprietário; proteção do último proprietário e revogação imediata de acesso.
- Auditoria com autor e valores anteriores/posteriores das coordenadas.
- Exportações CSV, GeoJSON e ZIP com dados e fotos somente do espaço selecionado; exclusão de foto pelo servidor.
- Interface no Chromium com login real, organização anterior selecionada e painel de equipe em tamanho móvel sem transbordamento horizontal ou erros de página.

Os testes PostgreSQL passaram após a correção da seleção do catálogo anterior. O build de produção e a verificação TypeScript também passaram. A conta, as organizações, os registros e os arquivos temporários usados na validação foram removidos. As cópias anteriores e os resultados detalhados ficam na pasta local ignorada `.vercel/campo-validation/`; credenciais não são versionadas nem enviadas no deploy.

## Continuidade

O acesso inicial da conta proprietária está no arquivo local privado `.vercel/campo-validation/owner-login.txt`. Cadastro e recuperação de contas continuam no fluxo administrativo do Supabase, conforme o [guia profissional](CAMPO_PRO_AUTH.md).

As Fases 1 a 3 têm entrega técnica disponível. A validação de uso com profissionais prevista no roadmap continua pendente. Relatórios comerciais, compartilhamento, planos e cobrança pertencem à Fase 4, condicionada a essa validação.
