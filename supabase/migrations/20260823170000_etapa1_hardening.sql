-- ============================================================================
-- ETAPA 1 · Blindagem
-- ============================================================================
-- Correções pontuais de segurança, auditoria e coerência. Nenhuma mudança de
-- arquitetura: os princípios (razão imutável, saldo derivado, razão separado
-- da trilha, nenhuma transferência genérica, produto que saiu não volta,
-- praça sem saldo) permanecem intactos.
--
-- Nota sobre FORCE ROW LEVEL SECURITY: NÃO é aplicado de propósito. Ele faria
-- a RLS valer também para o dono da tabela, e as funções SECURITY DEFINER
-- rodam justamente como dono — ligá-lo quebraria toda a escrita legítima. A
-- proteção correta aqui é ausência de policy de escrita para `authenticated`.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. RLS: cadastro deixa de permitir DELETE
-- ---------------------------------------------------------------------------
-- Item e setor são referenciados por movimento, contagem e parâmetro. Apagar
-- é o caminho para perder rastro; desativar (ativo = false) preserva a
-- história. A FK já barraria o apagar com movimento, mas um item recém-criado
-- e sem movimento era apagável — e isso não deve existir num sistema de
-- auditoria.
drop policy if exists estoque_setores_gestao on public.estoque_setores;
drop policy if exists estoque_itens_gestao   on public.estoque_itens;

create policy estoque_setores_insere on public.estoque_setores
  for insert to authenticated
  with check (public.estoque_pode(unidade_id, 'cadastro.gerenciar'));
create policy estoque_setores_atualiza on public.estoque_setores
  for update to authenticated
  using (public.estoque_pode(unidade_id, 'cadastro.gerenciar'))
  with check (public.estoque_pode(unidade_id, 'cadastro.gerenciar'));

create policy estoque_itens_insere on public.estoque_itens
  for insert to authenticated
  with check (public.estoque_pode(unidade_id, 'cadastro.gerenciar'));
create policy estoque_itens_atualiza on public.estoque_itens
  for update to authenticated
  using (public.estoque_pode(unidade_id, 'cadastro.gerenciar'))
  with check (public.estoque_pode(unidade_id, 'cadastro.gerenciar'));

-- Catálogos de domínio: leitura para autenticado, escrita para ninguém pelo
-- cliente. Mudar fluxo ou causa é ato de migration, não de tela.
revoke insert, update, delete on public.estoque_fluxos              from authenticated;
revoke insert, update, delete on public.estoque_causas_divergencia  from authenticated;
revoke insert, update, delete on public.estoque_funcoes             from authenticated;
revoke insert, update, delete on public.estoque_permissoes          from authenticated;
revoke insert, update, delete on public.estoque_funcao_permissoes   from authenticated;

-- ---------------------------------------------------------------------------
-- 2. Contagem: guarda o esperado no momento do fechamento
-- ---------------------------------------------------------------------------
-- Necessário para a tela cega (item 7): depois de finalizar, o razão já foi
-- ajustado e o esperado se perderia. Congelar aqui permite mostrar
-- Contado x Esperado x Diferença sem recalcular nada.
alter table public.estoque_contagem_itens
  add column if not exists quantidade_esperada numeric(14,3);

comment on column public.estoque_contagem_itens.quantidade_esperada is
  'Saldo que o razão indicava no instante da finalização. Preenchido pela finalização, nunca digitado.';

-- ---------------------------------------------------------------------------
-- 3. Conclusão formal do inventário por local
-- ---------------------------------------------------------------------------
-- Um local pode ter, legitimamente, todos os itens em zero. Então a existência
-- de movimento NÃO prova que o local foi contado. A conclusão é um ato
-- explícito, com responsável e horário.
create table if not exists public.estoque_inventario_locais (
  id            uuid primary key default gen_random_uuid(),
  unidade_id    uuid not null references public.unidades (id),
  local_id      uuid not null references public.estoque_locais (id),
  itens_com_saldo integer not null default 0,
  concluido_por uuid not null references auth.users (id),
  concluido_em  timestamptz not null default now(),
  funcao_exercida text references public.estoque_funcoes (codigo),
  constraint estoque_inventario_locais_unico unique (unidade_id, local_id)
);

alter table public.estoque_inventario_locais enable row level security;

drop policy if exists estoque_inv_locais_leitura on public.estoque_inventario_locais;
create policy estoque_inv_locais_leitura on public.estoque_inventario_locais
  for select to authenticated using (public.estoque_pode_ver(unidade_id));

/** Declara que a contagem física deste local terminou. */
create or replace function public.estoque_concluir_inventario_local(
  p_unidade_id uuid, p_local_id uuid
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_tipo  text;
  v_itens integer;
  v_id    uuid;
begin
  if not public.estoque_pode(p_unidade_id, 'saldo_inicial.lancar') then
    raise exception 'Sem permissão para concluir inventário de implantação.';
  end if;

  if exists (select 1 from public.estoque_unidade_config
             where unidade_id = p_unidade_id and em_producao) then
    raise exception 'Unidade já está em produção. O inventário de implantação está encerrado.';
  end if;

  select tipo into v_tipo from public.estoque_locais
   where id = p_local_id and unidade_id = p_unidade_id;
  if v_tipo is null then
    raise exception 'Local não pertence a esta unidade.';
  end if;
  if v_tipo not in ('PRINCIPAL', 'PULMAO') then
    raise exception 'Só o Estoque Principal e os pulmões entram no inventário de implantação.';
  end if;

  select count(*) into v_itens
  from public.estoque_saldos_locais
  where local_id = p_local_id and quantidade > 0;

  insert into public.estoque_inventario_locais
    (unidade_id, local_id, itens_com_saldo, concluido_por, funcao_exercida)
  values
    (p_unidade_id, p_local_id, v_itens, auth.uid(),
     public.estoque_funcao_exercida(p_unidade_id))
  on conflict (unidade_id, local_id) do nothing
  returning id into v_id;

  if v_id is null then
    raise exception 'Este local já foi concluído.';
  end if;

  perform public.estoque_registrar_evento(
    p_unidade_id, 'INVENTARIO_LOCAL_CONCLUIDO', 'LOCAL', p_local_id, null,
    jsonb_build_object('itens_com_saldo', v_itens, 'tipo', v_tipo));

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Virada só com TODOS os locais concluídos
-- ---------------------------------------------------------------------------
create or replace function public.estoque_marcar_em_producao(p_unidade_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_faltando text;
begin
  if not public.estoque_pode(p_unidade_id, 'saldo_inicial.lancar') then
    raise exception 'Sem permissão para marcar a unidade como em produção.';
  end if;

  select string_agg(l.nome, ', ' order by l.nome) into v_faltando
  from public.estoque_locais l
  where l.unidade_id = p_unidade_id
    and l.ativo
    and l.tipo in ('PRINCIPAL', 'PULMAO')
    and not exists (
      select 1 from public.estoque_inventario_locais il
      where il.unidade_id = p_unidade_id and il.local_id = l.id
    );

  if v_faltando is not null then
    raise exception
      'Inventário de implantação incompleto. Falta concluir: %.', v_faltando;
  end if;

  insert into public.estoque_unidade_config
    (unidade_id, em_producao, producao_desde, atualizado_por)
  values (p_unidade_id, true, now(), auth.uid())
  on conflict (unidade_id) do update
    set em_producao = true, producao_desde = now(), atualizado_por = auth.uid();

  perform public.estoque_registrar_evento(
    p_unidade_id, 'UNIDADE_EM_PRODUCAO', 'UNIDADE', p_unidade_id, null,
    jsonb_build_object('locais_concluidos', (
      select count(*) from public.estoque_inventario_locais
      where unidade_id = p_unidade_id)));
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Contagem: rastro de edição antes da finalização
-- ---------------------------------------------------------------------------
create or replace function public.estoque_lancar_contagem_item(
  p_contagem_id uuid, p_item_id uuid, p_quantidade numeric
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_c        public.estoque_contagens%rowtype;
  v_anterior numeric;
begin
  select * into v_c from public.estoque_contagens where id = p_contagem_id;
  if not found then raise exception 'Contagem não encontrada.'; end if;
  if v_c.situacao <> 'EM_PREENCHIMENTO' then
    raise exception 'Contagem já finalizada. Abra a do próximo ciclo.';
  end if;
  if not public.estoque_pode_no_setor(v_c.unidade_id, v_c.setor_id, 'pulmao.contar') then
    raise exception 'Sem permissão para contar o pulmão deste setor.';
  end if;
  if p_quantidade is null or p_quantidade < 0 then
    raise exception 'Quantidade inválida.';
  end if;

  select quantidade into v_anterior
  from public.estoque_contagem_itens
  where contagem_id = p_contagem_id and item_id = p_item_id;

  insert into public.estoque_contagem_itens (contagem_id, item_id, quantidade, lancado_por)
  values (p_contagem_id, p_item_id, p_quantidade, auth.uid())
  on conflict (contagem_id, item_id) do update
    set quantidade = excluded.quantidade,
        lancado_por = auth.uid(),
        lancado_em = now();

  -- Corrigir antes de finalizar é permitido; apagar o rastro não é.
  if v_anterior is not null and v_anterior <> p_quantidade then
    perform public.estoque_registrar_evento(
      v_c.unidade_id, 'CONTAGEM_ITEM_ALTERADO', 'CONTAGEM', p_contagem_id,
      jsonb_build_object('item_id', p_item_id, 'quantidade', v_anterior),
      jsonb_build_object('item_id', p_item_id, 'quantidade', p_quantidade));
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Finalização: valida o líder responsável no banco
-- ---------------------------------------------------------------------------
create or replace function public.estoque_finalizar_contagem(
  p_contagem_id uuid, p_lider_responsavel uuid
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_c        public.estoque_contagens%rowtype;
  v_pulmao   uuid;
  v_item     record;
  v_faltando text;
  v_sond     integer := 0;
  v_diverg   integer := 0;
  v_ativo    boolean;
  v_tem_funcao boolean;
begin
  select * into v_c from public.estoque_contagens where id = p_contagem_id;
  if not found then raise exception 'Contagem não encontrada.'; end if;
  if v_c.situacao = 'FINALIZADA' then raise exception 'Contagem já finalizada.'; end if;

  if not public.estoque_pode_no_setor(
       v_c.unidade_id, v_c.setor_id, 'pulmao.finalizar_contagem') then
    raise exception 'Auxiliar pode preencher, mas quem finaliza e responde pela contagem é o líder.';
  end if;
  if p_lider_responsavel is null then
    raise exception 'A contagem precisa nomear o líder responsável (RB-012).';
  end if;

  -- ####################################################################
  -- O líder responsável não pode ser um uuid qualquer. A lista da tela é
  -- conveniência; a regra é aqui.
  -- ####################################################################
  select coalesce(ativo, true) into v_ativo
  from public.profiles where id = p_lider_responsavel;

  if v_ativo is null then
    raise exception 'Líder responsável informado não existe.';
  end if;
  if not v_ativo then
    raise exception 'Líder responsável está inativo.';
  end if;

  select exists (
    select 1
    from public.estoque_pessoa_funcoes pf
    where pf.pessoa_id = p_lider_responsavel
      and pf.unidade_id = v_c.unidade_id
      and pf.funcao_codigo in ('LIDER_SETOR','SUBCHEFE','GERENTE_CPD','DIRECAO')
      and pf.inicio <= now()
      and (pf.fim is null or pf.fim > now())
      -- Função de setor precisa ser DO setor da contagem; função de casa
      -- (setor_id nulo) vale para qualquer setor.
      and (pf.setor_id is null or pf.setor_id = v_c.setor_id)
  ) into v_tem_funcao;

  if not v_tem_funcao then
    raise exception
      'A pessoa indicada não exerce função de liderança vigente neste setor. Quem responde pela contagem tem de ter autoridade sobre ele.';
  end if;

  v_pulmao := public.estoque_local(v_c.unidade_id, 'PULMAO', v_c.setor_id);

  select string_agg(i.nome, ', ') into v_faltando
  from public.estoque_saldos_locais s
  join public.estoque_itens i on i.id = s.item_id
  where s.local_id = v_pulmao
    and s.quantidade > 0
    and not exists (
      select 1 from public.estoque_contagem_itens ci
      where ci.contagem_id = p_contagem_id and ci.item_id = s.item_id
    );

  if v_faltando is not null then
    raise exception 'Estes itens têm saldo no pulmão e não foram contados: %.', v_faltando;
  end if;

  for v_item in
    select ci.item_id,
           ci.quantidade as contado,
           coalesce(public.estoque_saldo_em(v_pulmao, ci.item_id), 0) as esperado
    from public.estoque_contagem_itens ci
    where ci.contagem_id = p_contagem_id
  loop
    -- Congela o esperado, para a tela poder mostrar Contado x Esperado x Diferença
    -- depois de o razão já ter sido ajustado.
    update public.estoque_contagem_itens
    set quantidade_esperada = v_item.esperado
    where contagem_id = p_contagem_id and item_id = v_item.item_id;

    if v_item.contado < v_item.esperado then
      insert into public.estoque_movimentos
        (unidade_id, item_id, local_origem_id, local_destino_id, quantidade,
         fluxo, documento_tipo, documento_id, registrado_por, funcao_exercida)
      values
        (v_c.unidade_id, v_item.item_id, v_pulmao, null,
         v_item.esperado - v_item.contado,
         'FECHAMENTO_PULMAO_SOND', 'CONTAGEM', p_contagem_id, auth.uid(),
         public.estoque_funcao_exercida(v_c.unidade_id));
      v_sond := v_sond + 1;

    elsif v_item.contado > v_item.esperado then
      insert into public.estoque_divergencias
        (unidade_id, setor_id, item_id, origem, quantidade, contagem_id)
      values
        (v_c.unidade_id, v_c.setor_id, v_item.item_id, 'CONTAGEM_ACIMA',
         v_item.contado - v_item.esperado, p_contagem_id);
      v_diverg := v_diverg + 1;
    end if;
  end loop;

  update public.estoque_contagens
  set situacao = 'FINALIZADA',
      finalizada_em = now(),
      finalizada_por = auth.uid(),
      lider_responsavel = p_lider_responsavel
  where id = p_contagem_id;

  perform public.estoque_registrar_evento(
    v_c.unidade_id, 'CONTAGEM_FINALIZADA', 'CONTAGEM', p_contagem_id, null,
    jsonb_build_object('lider_responsavel', p_lider_responsavel,
                       'saidas_nao_discriminadas', v_sond,
                       'divergencias_abertas', v_diverg));

  return jsonb_build_object('saidas_nao_discriminadas', v_sond,
                            'divergencias_abertas', v_diverg);
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Recebimento: quebra de custódia + recusa de excesso
-- ---------------------------------------------------------------------------
create or replace function public.estoque_confirmar_recebimento(
  p_rodada_id uuid, p_itens jsonb
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_r        public.estoque_rodadas%rowtype;
  v_transito uuid;
  v_pulmao   uuid;
  v_linha    record;
  v_residuo  numeric;
  v_n        integer := 0;
  v_pend     integer := 0;
  v_nome     text;
begin
  select * into v_r from public.estoque_rodadas where id = p_rodada_id;
  if not found then raise exception 'Rodada não encontrada.'; end if;
  if v_r.situacao <> 'SEPARADA' then
    raise exception 'Esta rodada não está aguardando recebimento.';
  end if;
  if not public.estoque_pode_no_setor(
       v_r.unidade_id, v_r.setor_id, 'abastecimento.receber') then
    raise exception 'Sem permissão para receber no pulmão deste setor.';
  end if;

  -- ####################################################################
  -- Quebra de custódia: o fluxo existe para haver conferência entre duas
  -- pessoas. Quem separou não confere a si mesmo.
  -- ####################################################################
  if v_r.separado_por = auth.uid() then
    raise exception
      'Quem confirmou a separação não pode confirmar o próprio recebimento. A conferência precisa de duas pessoas: o CPD separa, o líder do setor recebe.';
  end if;

  v_transito := public.estoque_local(v_r.unidade_id, 'TRANSITO', v_r.setor_id);
  v_pulmao   := public.estoque_local(v_r.unidade_id, 'PULMAO', v_r.setor_id);

  -- Valida tudo antes de gravar qualquer movimento: recebimento acima do
  -- separado é informação inconsistente e não deve ser "corrigida" em
  -- silêncio, porque é exatamente o comportamento fora do padrão que se
  -- quer enxergar.
  for v_linha in
    select ri.item_id, ri.qtd_separada,
           coalesce((
             select (x ->> 'quantidade')::numeric
             from jsonb_array_elements(coalesce(p_itens, '[]'::jsonb)) x
             where (x ->> 'item_id')::uuid = ri.item_id
           ), ri.qtd_separada) as informado
    from public.estoque_rodada_itens ri
    where ri.rodada_id = p_rodada_id and coalesce(ri.qtd_separada, 0) > 0
  loop
    if v_linha.informado is null or v_linha.informado < 0 then
      select nome into v_nome from public.estoque_itens where id = v_linha.item_id;
      raise exception 'Quantidade recebida inválida para "%".', v_nome;
    end if;
    if v_linha.informado > v_linha.qtd_separada then
      select nome into v_nome from public.estoque_itens where id = v_linha.item_id;
      raise exception
        'A quantidade recebida não pode ser maior que a quantidade separada. Item "%": separado %, informado %.',
        v_nome, v_linha.qtd_separada, v_linha.informado;
    end if;
  end loop;

  for v_linha in
    select ri.item_id, ri.qtd_separada,
           coalesce((
             select (x ->> 'quantidade')::numeric
             from jsonb_array_elements(coalesce(p_itens, '[]'::jsonb)) x
             where (x ->> 'item_id')::uuid = ri.item_id
           ), ri.qtd_separada) as recebido
    from public.estoque_rodada_itens ri
    where ri.rodada_id = p_rodada_id and coalesce(ri.qtd_separada, 0) > 0
  loop
    v_residuo := v_linha.qtd_separada - v_linha.recebido;

    if v_linha.recebido > 0 then
      insert into public.estoque_movimentos
        (unidade_id, item_id, local_origem_id, local_destino_id, quantidade,
         fluxo, documento_tipo, documento_id, registrado_por, funcao_exercida)
      values
        (v_r.unidade_id, v_linha.item_id, v_transito, v_pulmao, v_linha.recebido,
         'ABASTECIMENTO_RECEBIMENTO', 'RODADA', p_rodada_id, auth.uid(),
         public.estoque_funcao_exercida(v_r.unidade_id));
      v_n := v_n + 1;
    end if;

    update public.estoque_rodada_itens
    set qtd_recebida = v_linha.recebido
    where rodada_id = p_rodada_id and item_id = v_linha.item_id;

    if v_residuo > 0 then
      insert into public.estoque_divergencias
        (unidade_id, setor_id, item_id, origem, quantidade, rodada_id)
      values
        (v_r.unidade_id, v_r.setor_id, v_linha.item_id, 'TRANSITO', v_residuo, p_rodada_id);
      v_pend := v_pend + 1;
    end if;
  end loop;

  update public.estoque_rodadas
  set situacao = 'RECEBIDA', recebido_por = auth.uid(), recebido_em = now()
  where id = p_rodada_id;

  perform public.estoque_registrar_evento(
    v_r.unidade_id, 'RECEBIMENTO_CONFIRMADO', 'RODADA', p_rodada_id, null,
    jsonb_build_object('itens_recebidos', v_n, 'divergencias_abertas', v_pend));

  return jsonb_build_object('itens_recebidos', v_n, 'divergencias_abertas', v_pend);
end;
$$;
