-- ============================================================================
-- ETAPA 1 · Reinicialização para a virada + saldo inicial nos pulmões (L13)
-- ============================================================================
-- Decisão do Victor (23/ago/2026): o sistema começa de um Inventário de
-- Implantação NOVO, feito fisicamente no momento da virada, contando Estoque
-- Principal E pulmões dos setores. A praça permanece fora do saldo nesta etapa.
--
-- Duas coisas acontecem aqui:
--
-- 1. O saldo inicial passa a poder entrar no pulmão. Sem isso, a primeira
--    contagem de cada setor viraria "contado > esperado" para todo item, e
--    dezenas de divergências falsas no dia um enterrariam o sinal real.
--
-- 2. Saldos, contagens e movimentações atuais são apagados. O CADASTRO dos 87
--    itens, os setores, os locais e a autoridade são preservados.
--
-- Para apagar o razão é preciso desligar a trigger de imutabilidade. Isso é
-- deliberado, acontece uma única vez, aqui, e está registrado: depois da
-- virada não existe mais caminho para apagar movimento.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Fluxo de saldo inicial no pulmão
-- ---------------------------------------------------------------------------
insert into public.estoque_fluxos (codigo, nome, origem_tipo, destino_tipo, descricao) values
  ('SALDO_INICIAL_PULMAO', 'Inventário de implantação — pulmão', null, 'PULMAO',
   'Mesma natureza do SALDO_INICIAL, com destino no pulmão do setor. Na virada os pulmões têm mercadoria física e o sistema precisa nascer sabendo disso.')
on conflict (codigo) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Reinicialização
-- ---------------------------------------------------------------------------
do $$
declare
  v_mov integer; v_inv integer; v_ant integer;
begin
  select count(*) into v_mov from public.estoque_movimentos;
  select count(*) into v_inv from public.estoque_inventarios;
  select count(*) into v_ant from public.estoque_lancamentos;

  raise notice 'Reinicializando: % movimentos, % inventarios, % lancamentos do modelo antigo.',
    v_mov, v_inv, v_ant;

  -- Razão novo
  alter table public.estoque_movimentos disable trigger estoque_movimentos_imutavel;
  delete from public.estoque_movimentos;
  alter table public.estoque_movimentos enable trigger estoque_movimentos_imutavel;

  delete from public.estoque_inventario_itens;
  delete from public.estoque_inventarios;
  delete from public.estoque_contagem_itens;
  delete from public.estoque_contagens;
  delete from public.estoque_rodada_itens;
  delete from public.estoque_rodadas;
  delete from public.estoque_divergencias;

  -- Trilha: os eventos que existiam referenciavam movimentos que deixaram de
  -- existir. Zerar aqui é honesto; a trilha definitiva começa na virada.
  alter table public.estoque_eventos disable trigger estoque_eventos_imutavel;
  delete from public.estoque_eventos;
  alter table public.estoque_eventos enable trigger estoque_eventos_imutavel;

  -- Modelo antigo: esvaziado para o app que está no ar parar de exibir saldo
  -- que não existe mais. As tabelas saem de vez junto com o deploy das telas.
  alter table public.estoque_lancamentos disable trigger estoque_lancamentos_imutavel;
  delete from public.estoque_lancamentos;
  alter table public.estoque_lancamentos enable trigger estoque_lancamentos_imutavel;

  alter table public.estoque_transacoes disable trigger estoque_transacoes_imutavel;
  delete from public.estoque_transacoes;
  alter table public.estoque_transacoes enable trigger estoque_transacoes_imutavel;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Inventário de implantação — agora com pulmões
-- ---------------------------------------------------------------------------
-- p_itens: [{"item_id":"...","quantidade":37,"setor_id":null}, ...]
--          setor_id nulo  -> Estoque Principal
--          setor_id ativo -> pulmão daquele setor
create or replace function public.estoque_lancar_inventario_implantacao(
  p_unidade_id uuid,
  p_itens      jsonb,
  p_data       date default current_date,
  p_observacao text default null
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_inv    uuid;
  v_linha  jsonb;
  v_item   uuid;
  v_qtd    numeric;
  v_setor  uuid;
  v_local  uuid;
  v_fluxo  text;
  v_n      integer := 0;
  v_nome   text;
begin
  if not public.estoque_pode(p_unidade_id, 'saldo_inicial.lancar') then
    raise exception 'Sem permissão para lançar inventário de implantação.';
  end if;

  if exists (select 1 from public.estoque_unidade_config
             where unidade_id = p_unidade_id and em_producao) then
    raise exception
      'Unidade já está em produção. Saldo não se digita mais: use os fluxos de movimentação.';
  end if;

  insert into public.estoque_inventarios (unidade_id, data_referencia, responsavel, observacao)
  values (p_unidade_id, p_data, auth.uid(), p_observacao)
  returning id into v_inv;

  for v_linha in select * from jsonb_array_elements(coalesce(p_itens, '[]'::jsonb))
  loop
    v_item  := (v_linha ->> 'item_id')::uuid;
    v_qtd   := (v_linha ->> 'quantidade')::numeric;
    v_setor := nullif(v_linha ->> 'setor_id', '')::uuid;

    if v_qtd is null or v_qtd <= 0 then continue; end if;

    if v_setor is null then
      v_local := public.estoque_local(p_unidade_id, 'PRINCIPAL');
      v_fluxo := 'SALDO_INICIAL';
    else
      v_local := public.estoque_local(p_unidade_id, 'PULMAO', v_setor);
      v_fluxo := 'SALDO_INICIAL_PULMAO';
      if v_local is null then
        raise exception 'Setor informado não tem pulmão cadastrado.';
      end if;
    end if;

    -- Um saldo inicial por (item, local). Repetição se corrige por movimento.
    if exists (
      select 1 from public.estoque_movimentos
      where fluxo in ('SALDO_INICIAL','SALDO_INICIAL_PULMAO')
        and item_id = v_item and local_destino_id = v_local
    ) then
      select nome into v_nome from public.estoque_itens where id = v_item;
      raise exception 'Já existe saldo inicial de "%" neste local.', v_nome;
    end if;

    insert into public.estoque_inventario_itens (inventario_id, local_id, item_id, quantidade)
    values (v_inv, v_local, v_item, v_qtd);

    insert into public.estoque_movimentos
      (unidade_id, item_id, local_origem_id, local_destino_id, quantidade,
       fluxo, documento_tipo, documento_id, registrado_por, funcao_exercida)
    values
      (p_unidade_id, v_item, null, v_local, v_qtd,
       v_fluxo, 'INVENTARIO', v_inv, auth.uid(),
       public.estoque_funcao_exercida(p_unidade_id));

    v_n := v_n + 1;
  end loop;

  perform public.estoque_registrar_evento(
    p_unidade_id, 'INVENTARIO_IMPLANTACAO', 'INVENTARIO', v_inv, null,
    jsonb_build_object('itens', v_n, 'data_referencia', p_data), null, p_observacao);

  return jsonb_build_object('inventario_id', v_inv, 'itens', v_n);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Virar a chave — depois disto, saldo só muda por fluxo
-- ---------------------------------------------------------------------------
create or replace function public.estoque_marcar_em_producao(p_unidade_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_itens integer;
begin
  if not public.estoque_pode(p_unidade_id, 'saldo_inicial.lancar') then
    raise exception 'Sem permissão para marcar a unidade como em produção.';
  end if;

  select count(*) into v_itens from public.estoque_movimentos
   where unidade_id = p_unidade_id
     and fluxo in ('SALDO_INICIAL','SALDO_INICIAL_PULMAO');

  if v_itens = 0 then
    raise exception
      'Nenhum inventário de implantação lançado. A unidade entraria em produção com estoque zerado.';
  end if;

  insert into public.estoque_unidade_config (unidade_id, em_producao, producao_desde, atualizado_por)
  values (p_unidade_id, true, now(), auth.uid())
  on conflict (unidade_id) do update
    set em_producao = true, producao_desde = now(), atualizado_por = auth.uid();

  perform public.estoque_registrar_evento(
    p_unidade_id, 'UNIDADE_EM_PRODUCAO', 'UNIDADE', p_unidade_id, null,
    jsonb_build_object('itens_no_inventario', v_itens));
end;
$$;
