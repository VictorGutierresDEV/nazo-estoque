-- ============================================================================
-- Blindagem complementar: local concluído não recebe mais lançamento
-- ============================================================================
-- Sem isto, declarar um local concluído não significava nada: dava para
-- continuar lançando itens nele depois. A conclusão precisa fechar o local,
-- senão a checagem da virada verifica um estado que ainda pode mudar.
-- ============================================================================
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

    -- Local declarado concluído está fechado para lançamento.
    if exists (
      select 1 from public.estoque_inventario_locais
      where unidade_id = p_unidade_id and local_id = v_local
    ) then
      select nome into v_nome from public.estoque_locais where id = v_local;
      raise exception
        'O inventário de "%" já foi concluído e não aceita mais lançamento.', v_nome;
    end if;

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
