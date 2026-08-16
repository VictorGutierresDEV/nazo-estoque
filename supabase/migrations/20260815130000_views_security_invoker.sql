-- ============================================================================
-- Corrige vazamento entre unidades nas views de leitura
-- ============================================================================
-- No Postgres, uma view roda por padrão com as permissões de QUEM A CRIOU, e
-- não de quem a consulta (security_invoker = false). Como estas views foram
-- criadas pelo owner do banco, a RLS de estoque_lancamentos e
-- estoque_transacoes NÃO era aplicada ao consultá-las: qualquer usuário
-- autenticado conseguiria ler o saldo e o extrato de QUALQUER unidade
-- simplesmente consultando a view direto pela API.
--
-- Com security_invoker = true a view passa a rodar como o usuário da
-- consulta, e as policies das tabelas de baixo voltam a valer.
--
-- É exatamente a classe de falha que a auditoria apontou no vStoque
-- (queries sem filtro de unidade_id vazando entre lojas). Aqui o filtro não
-- fica a cargo da tela: fica no banco.
-- ============================================================================

alter view public.estoque_saldos  set (security_invoker = true);
alter view public.estoque_extrato set (security_invoker = true);
