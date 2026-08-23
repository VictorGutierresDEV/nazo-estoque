-- ============================================================================
-- Remove o modelo anterior à Etapa 1
-- ============================================================================
-- Aquele desenho conflava pulmão e praça num único bucket, permitia devolução
-- ao estoque principal (contra RB-009) e tinha uma operação de transferência
-- genérica que eu havia inventado. As tabelas já foram esvaziadas na
-- reinicialização; aqui elas saem de vez, junto com o deploy das telas novas.
--
-- Ordem importa: as policies das tabelas antigas dependem de
-- estoque_pode_operar, então as tabelas caem antes das funções.
-- ============================================================================

drop view if exists public.estoque_extrato;
drop view if exists public.estoque_saldos;

drop table if exists public.estoque_lancamentos;
drop table if exists public.estoque_transacoes;
drop table if exists public.estoque_produtos;
drop table if exists public.estoque_pracas;

drop function if exists public.estoque_registrar_entrada(uuid, jsonb, text, text, timestamptz, text);
drop function if exists public.estoque_registrar_saida(uuid, uuid, uuid, jsonb, text, timestamptz);
drop function if exists public.estoque_estornar(uuid, text);
drop function if exists public.estoque_pode_operar(uuid);
drop function if exists public.estoque_unidade_atual();
