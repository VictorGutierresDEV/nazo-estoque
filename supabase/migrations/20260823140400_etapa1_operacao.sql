-- ============================================================================
-- ETAPA 1 · Parte 5/6 — Ciclo operacional
-- ============================================================================
-- Contagem do pulmão -> sugestão -> separação -> trânsito -> recebimento,
-- com o resíduo permanecendo visível até a apuração.
--
-- Duas decisões do Contexto Mestre estão codificadas aqui e valem releitura:
--
-- 1. FECHAMENTO DO PULMÃO (L11). Enquanto o fluxo Pulmão -> Praça não existir,
--    a diferença entre saldo esperado e contagem física fecha o ciclo como
--    SAÍDA OPERACIONAL NÃO DISCRIMINADA. Não é perda, não é divergência, e
--    sua magnitude NÃO é sinal de anomalia: pulmão que começa com 30 e termina
--    com 5 é operação normal alimentando a praça.
--
--    A assimetria é o ponto: se o contado for MAIOR que o esperado, não existe
--    "consumo negativo" nem entrada automática. Abre-se divergência.
--
-- 2. APURAÇÃO DE RESÍDUO (L12). A causa determina os destinos possíveis, não o
--    operador. Devolver ao PRINCIPAL só é permitido quando a causa comprova que
--    a mercadoria nunca deixou a custódia. Se ela saiu — mesmo que só até a
--    porta — não volta (RB-009).
-- ============================================================================

-- Enquanto a unidade não está em produção, o inventário de implantação é
-- permitido. Depois disso, ninguém digita saldo (P3).
create table if not exists public.estoque_unidade_config (
  unidade_id     uuid primary key references public.unidades (id),
  em_producao    boolean not null default false,
  producao_desde timestamptz,
  atualizado_por uuid references auth.users (id)
);

-- ---------------------------------------------------------------------------
-- Contagem do pulmão
-- ---------------------------------------------------------------------------
create table if not exists public.estoque_contagens (
  id            uuid primary key default gen_random_uuid(),
  unidade_id    uuid not null references public.unidades (id),
  setor_id      uuid not null references public.estoque_setores (id),
  -- Ciclo de referência, separado do momento do lançamento: assim a contagem
  -- feita às 23h ou às 07h é atribuída à reposição correta.
  ciclo         date not null,
  situacao      text not null default 'EM_PREENCHIMENTO',
  aberta_por    uuid not null references auth.users (id),
  -- Quem preencheu pode ser auxiliar; quem RESPONDE é o líder (RB-012).
  lider_responsavel uuid references public.profiles (id),
  finalizada_em timestamptz,
  finalizada_por uuid references auth.users (id),
  criada_em     timestamptz not null default now(),
  constraint estoque_contagens_unica unique (unidade_id, setor_id, ciclo),
  constraint estoque_contagens_situacao
    check (situacao in ('EM_PREENCHIMENTO','FINALIZADA')),
  -- Só finaliza com líder responsável nomeado.
  constraint estoque_contagens_finalizada_tem_lider check (
    situacao <> 'FINALIZADA'
    or (lider_responsavel is not null and finalizada_em is not null)
  )
);

create table if not exists public.estoque_contagem_itens (
  id           uuid primary key default gen_random_uuid(),
  contagem_id  uuid not null references public.estoque_contagens (id) on delete cascade,
  item_id      uuid not null references public.estoque_itens (id),
  quantidade   numeric(14,3) not null,
  lancado_por  uuid not null references auth.users (id),
  lancado_em   timestamptz not null default now(),
  constraint estoque_contagem_itens_unico unique (contagem_id, item_id),
  constraint estoque_contagem_itens_nao_negativo check (quantidade >= 0)
);

-- ---------------------------------------------------------------------------
-- Rodada de abastecimento
-- ---------------------------------------------------------------------------
create table if not exists public.estoque_rodadas (
  id            uuid primary key default gen_random_uuid(),
  unidade_id    uuid not null references public.unidades (id),
  setor_id      uuid not null references public.estoque_setores (id),
  ciclo         date not null,
  contagem_id   uuid not null references public.estoque_contagens (id),
  situacao      text not null default 'SUGERIDA',
  separado_por  uuid references auth.users (id),
  separado_em   timestamptz,
  recebido_por  uuid references auth.users (id),
  recebido_em   timestamptz,
  criada_em     timestamptz not null default now(),
  constraint estoque_rodadas_unica unique (unidade_id, setor_id, ciclo),
  constraint estoque_rodadas_situacao
    check (situacao in ('SUGERIDA','SEPARADA','RECEBIDA'))
);

create table if not exists public.estoque_rodada_itens (
  id            uuid primary key default gen_random_uuid(),
  rodada_id     uuid not null references public.estoque_rodadas (id) on delete cascade,
  item_id       uuid not null references public.estoque_itens (id),
  -- Os três números coexistem de propósito: é o par sugerido x separado que
  -- depois revela mínimo mal calibrado.
  qtd_sugerida  numeric(14,3) not null default 0,
  qtd_separada  numeric(14,3),
  qtd_recebida  numeric(14,3),
  motivo_ajuste text,
  constraint estoque_rodada_itens_unico unique (rodada_id, item_id),
  constraint estoque_rodada_itens_nao_negativo check (
    qtd_sugerida >= 0
    and (qtd_separada is null or qtd_separada >= 0)
    and (qtd_recebida is null or qtd_recebida >= 0)
  ),
  constraint estoque_rodada_itens_recebido_nao_excede check (
    qtd_recebida is null or qtd_separada is null or qtd_recebida <= qtd_separada
  )
);

-- ---------------------------------------------------------------------------
-- Divergências e suas causas
-- ---------------------------------------------------------------------------
create table if not exists public.estoque_causas_divergencia (
  codigo        text primary key,
  nome          text not null,
  fluxo_destino text references public.estoque_fluxos (codigo),
  exige_motivo  boolean not null default false,
  aplica_a      text not null
);

insert into public.estoque_causas_divergencia
  (codigo, nome, fluxo_destino, exige_motivo, aplica_a) values
  ('ERRO_SEPARACAO', 'Separação registrou mais do que fisicamente saiu',
   'APURACAO_CORRECAO_REGISTRO', true, 'TRANSITO'),
  ('FICOU_NA_PORTA', 'Ficou na porta e foi recolhido depois',
   'APURACAO_RECEBIMENTO_COMPLEMENTAR', false, 'TRANSITO'),
  ('ERRO_CONFERENCIA', 'Erro de conferência no recebimento',
   'APURACAO_RECEBIMENTO_COMPLEMENTAR', false, 'TRANSITO'),
  ('PERDA_TRANSITO', 'Perda entre a porta e o pulmão',
   'APURACAO_PERDA_TRANSITO', true, 'TRANSITO'),
  ('OUTRA_PARA_PULMAO', 'Outra causa — mercadoria chegou ao pulmão',
   'APURACAO_RECEBIMENTO_COMPLEMENTAR', true, 'TRANSITO'),
  ('ERRO_CONTAGEM', 'Erro na contagem informada',
   null, true, 'CONTAGEM_ACIMA'),
  ('OUTRA_CONTAGEM', 'Outra causa apurada na contagem',
   null, true, 'CONTAGEM_ACIMA')
on conflict (codigo) do nothing;

comment on table public.estoque_causas_divergencia is
  'A causa determina o destino do resíduo. Só ERRO_SEPARACAO devolve ao PRINCIPAL, porque é a única que comprova que a mercadoria nunca saiu (L12).';

create table if not exists public.estoque_divergencias (
  id            uuid primary key default gen_random_uuid(),
  unidade_id    uuid not null references public.unidades (id),
  setor_id      uuid not null references public.estoque_setores (id),
  item_id       uuid not null references public.estoque_itens (id),
  origem        text not null,
  quantidade    numeric(14,3) not null,
  rodada_id     uuid references public.estoque_rodadas (id),
  contagem_id   uuid references public.estoque_contagens (id),
  situacao      text not null default 'PENDENTE',
  causa         text references public.estoque_causas_divergencia (codigo),
  motivo        text,
  apurado_por   uuid references auth.users (id),
  apurado_em    timestamptz,
  criada_em     timestamptz not null default now(),
  constraint estoque_divergencias_origem
    check (origem in ('TRANSITO','CONTAGEM_ACIMA')),
  constraint estoque_divergencias_situacao
    check (situacao in ('PENDENTE','APURADA')),
  constraint estoque_divergencias_qtd_positiva check (quantidade > 0),
  constraint estoque_divergencias_apurada_tem_causa check (
    situacao <> 'APURADA' or (causa is not null and apurado_em is not null)
  )
);

create index if not exists estoque_divergencias_pendentes_idx
  on public.estoque_divergencias (unidade_id, criada_em)
  where situacao = 'PENDENTE';

-- ---------------------------------------------------------------------------
-- Inventário de implantação — a única origem de saldo sem movimento anterior
-- ---------------------------------------------------------------------------
create table if not exists public.estoque_inventarios (
  id             uuid primary key default gen_random_uuid(),
  unidade_id     uuid not null references public.unidades (id),
  data_referencia date not null,
  responsavel    uuid not null references auth.users (id),
  observacao     text,
  criado_em      timestamptz not null default now()
);

create table if not exists public.estoque_inventario_itens (
  id            uuid primary key default gen_random_uuid(),
  inventario_id uuid not null references public.estoque_inventarios (id) on delete cascade,
  local_id      uuid not null references public.estoque_locais (id),
  item_id       uuid not null references public.estoque_itens (id),
  quantidade    numeric(14,3) not null,
  constraint estoque_inventario_itens_unico unique (inventario_id, local_id, item_id),
  constraint estoque_inventario_itens_positivo check (quantidade > 0)
);

-- ===========================================================================
-- FLUXOS
-- ===========================================================================

/** Local de um tipo para um setor (ou o principal da unidade). */
create or replace function public.estoque_local(
  p_unidade_id uuid, p_tipo text, p_setor_id uuid default null
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.estoque_locais
  where unidade_id = p_unidade_id
    and tipo = p_tipo
    and (p_tipo = 'PRINCIPAL' or setor_id = p_setor_id)
  limit 1
$$;

-- ---------------------------------------------------------------------------
-- Contagem
-- ---------------------------------------------------------------------------
create or replace function public.estoque_abrir_contagem(
  p_unidade_id uuid, p_setor_id uuid, p_ciclo date default current_date
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_id uuid;
begin
  if not public.estoque_pode_no_setor(p_unidade_id, p_setor_id, 'pulmao.contar') then
    raise exception 'Sem permissão para contar o pulmão deste setor.';
  end if;

  select id into v_id from public.estoque_contagens
  where unidade_id = p_unidade_id and setor_id = p_setor_id and ciclo = p_ciclo;
  if v_id is not null then return v_id; end if;

  insert into public.estoque_contagens (unidade_id, setor_id, ciclo, aberta_por)
  values (p_unidade_id, p_setor_id, p_ciclo, auth.uid())
  returning id into v_id;

  perform public.estoque_registrar_evento(
    p_unidade_id, 'CONTAGEM_ABERTA', 'CONTAGEM', v_id, null,
    jsonb_build_object('setor_id', p_setor_id, 'ciclo', p_ciclo));

  return v_id;
end;
$$;

/** Auxiliar pode lançar. Finalizar é outra permissão. */
create or replace function public.estoque_lancar_contagem_item(
  p_contagem_id uuid, p_item_id uuid, p_quantidade numeric
)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_c public.estoque_contagens%rowtype;
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

  insert into public.estoque_contagem_itens (contagem_id, item_id, quantidade, lancado_por)
  values (p_contagem_id, p_item_id, p_quantidade, auth.uid())
  on conflict (contagem_id, item_id) do update
    set quantidade = excluded.quantidade,
        lancado_por = auth.uid(),
        lancado_em = now();
end;
$$;

/**
 * Finaliza a contagem e fecha o ciclo do pulmão.
 *
 * Aqui vive a regra do L11. Para cada item:
 *   contado <  esperado  -> saída operacional não discriminada
 *   contado >  esperado  -> divergência, SEM movimento
 *   contado =  esperado  -> nada
 */
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
  v_mov      uuid;
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

  v_pulmao := public.estoque_local(v_c.unidade_id, 'PULMAO', v_c.setor_id);

  -- Nenhum item com saldo pode ficar de fora: zerar por omissão seria
  -- inventar uma saída que ninguém contou.
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
    if v_item.contado < v_item.esperado then
      insert into public.estoque_movimentos
        (unidade_id, item_id, local_origem_id, local_destino_id, quantidade,
         fluxo, documento_tipo, documento_id, registrado_por, funcao_exercida)
      values
        (v_c.unidade_id, v_item.item_id, v_pulmao, null,
         v_item.esperado - v_item.contado,
         'FECHAMENTO_PULMAO_SOND', 'CONTAGEM', p_contagem_id, auth.uid(),
         public.estoque_funcao_exercida(v_c.unidade_id))
      returning id into v_mov;
      v_sond := v_sond + 1;

    elsif v_item.contado > v_item.esperado then
      -- Sem entrada automática e sem consumo negativo (L11).
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
-- Rodada
-- ---------------------------------------------------------------------------
create or replace function public.estoque_gerar_rodada(p_contagem_id uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_c  public.estoque_contagens%rowtype;
  v_id uuid;
begin
  select * into v_c from public.estoque_contagens where id = p_contagem_id;
  if not found then raise exception 'Contagem não encontrada.'; end if;
  if v_c.situacao <> 'FINALIZADA' then
    raise exception 'Só contagem finalizada gera rodada de abastecimento.';
  end if;
  if not public.estoque_pode(v_c.unidade_id, 'abastecimento.separar') then
    raise exception 'Sem permissão para preparar abastecimento.';
  end if;

  select id into v_id from public.estoque_rodadas
  where unidade_id = v_c.unidade_id and setor_id = v_c.setor_id and ciclo = v_c.ciclo;
  if v_id is not null then return v_id; end if;

  insert into public.estoque_rodadas (unidade_id, setor_id, ciclo, contagem_id)
  values (v_c.unidade_id, v_c.setor_id, v_c.ciclo, p_contagem_id)
  returning id into v_id;

  -- Sugestão = mínimo do pulmão - contado. É sugestão, não ordem.
  insert into public.estoque_rodada_itens (rodada_id, item_id, qtd_sugerida)
  select v_id, mp.item_id,
         greatest(0, mp.quantidade - coalesce(ci.quantidade, 0))
  from public.estoque_minimo_pulmao mp
  left join public.estoque_contagem_itens ci
    on ci.contagem_id = p_contagem_id and ci.item_id = mp.item_id
  where mp.unidade_id = v_c.unidade_id
    and mp.setor_id = v_c.setor_id
    and greatest(0, mp.quantidade - coalesce(ci.quantidade, 0)) > 0;

  perform public.estoque_registrar_evento(
    v_c.unidade_id, 'RODADA_GERADA', 'RODADA', v_id, null,
    jsonb_build_object('contagem_id', p_contagem_id, 'setor_id', v_c.setor_id));

  return v_id;
end;
$$;

create or replace function public.estoque_ajustar_separacao(
  p_rodada_id uuid, p_item_id uuid, p_quantidade numeric, p_motivo text default null
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_r public.estoque_rodadas%rowtype;
  v_anterior numeric;
begin
  select * into v_r from public.estoque_rodadas where id = p_rodada_id;
  if not found then raise exception 'Rodada não encontrada.'; end if;
  if v_r.situacao <> 'SUGERIDA' then
    raise exception 'A separação desta rodada já foi confirmada.';
  end if;
  if not public.estoque_pode(v_r.unidade_id, 'abastecimento.separar') then
    raise exception 'Sem permissão para ajustar a separação.';
  end if;
  if p_quantidade is null or p_quantidade < 0 then
    raise exception 'Quantidade inválida.';
  end if;

  select qtd_separada into v_anterior
  from public.estoque_rodada_itens where rodada_id = p_rodada_id and item_id = p_item_id;

  insert into public.estoque_rodada_itens (rodada_id, item_id, qtd_sugerida, qtd_separada, motivo_ajuste)
  values (p_rodada_id, p_item_id, 0, p_quantidade, p_motivo)
  on conflict (rodada_id, item_id) do update
    set qtd_separada = excluded.qtd_separada,
        motivo_ajuste = coalesce(excluded.motivo_ajuste, public.estoque_rodada_itens.motivo_ajuste);

  perform public.estoque_registrar_evento(
    v_r.unidade_id, 'SEPARACAO_AJUSTADA', 'RODADA', p_rodada_id,
    jsonb_build_object('qtd_separada', v_anterior),
    jsonb_build_object('item_id', p_item_id, 'qtd_separada', p_quantidade),
    null, p_motivo);
end;
$$;

/** Confirma a separação: PRINCIPAL -> TRANSITO. */
create or replace function public.estoque_confirmar_separacao(p_rodada_id uuid)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_r         public.estoque_rodadas%rowtype;
  v_principal uuid;
  v_transito  uuid;
  v_item      record;
  v_saldo     numeric;
  v_n         integer := 0;
  v_nome      text;
begin
  select * into v_r from public.estoque_rodadas where id = p_rodada_id;
  if not found then raise exception 'Rodada não encontrada.'; end if;
  if v_r.situacao <> 'SUGERIDA' then raise exception 'Separação já confirmada.'; end if;
  if not public.estoque_pode(v_r.unidade_id, 'abastecimento.separar') then
    raise exception 'Sem permissão para confirmar separação.';
  end if;

  v_principal := public.estoque_local(v_r.unidade_id, 'PRINCIPAL');
  v_transito  := public.estoque_local(v_r.unidade_id, 'TRANSITO', v_r.setor_id);

  for v_item in
    select item_id, coalesce(qtd_separada, qtd_sugerida) as qtd
    from public.estoque_rodada_itens
    where rodada_id = p_rodada_id
      and coalesce(qtd_separada, qtd_sugerida) > 0
  loop
    v_saldo := public.estoque_saldo_em(v_principal, v_item.item_id);
    if v_saldo < v_item.qtd then
      select nome into v_nome from public.estoque_itens where id = v_item.item_id;
      raise exception 'Saldo insuficiente de "%" no Estoque Principal: há %, separando %.',
        v_nome, v_saldo, v_item.qtd;
    end if;

    insert into public.estoque_movimentos
      (unidade_id, item_id, local_origem_id, local_destino_id, quantidade,
       fluxo, documento_tipo, documento_id, registrado_por, funcao_exercida)
    values
      (v_r.unidade_id, v_item.item_id, v_principal, v_transito, v_item.qtd,
       'ABASTECIMENTO_SEPARACAO', 'RODADA', p_rodada_id, auth.uid(),
       public.estoque_funcao_exercida(v_r.unidade_id));

    -- Congela o que foi efetivamente separado.
    update public.estoque_rodada_itens
    set qtd_separada = v_item.qtd
    where rodada_id = p_rodada_id and item_id = v_item.item_id;

    v_n := v_n + 1;
  end loop;

  update public.estoque_rodadas
  set situacao = 'SEPARADA', separado_por = auth.uid(), separado_em = now()
  where id = p_rodada_id;

  perform public.estoque_registrar_evento(
    v_r.unidade_id, 'SEPARACAO_CONFIRMADA', 'RODADA', p_rodada_id, null,
    jsonb_build_object('itens', v_n));

  return v_n;
end;
$$;

/**
 * Confirma o recebimento: TRANSITO -> PULMAO, na quantidade efetivamente
 * recebida. O que sobrar PERMANECE em trânsito e abre divergência pendente.
 * A operação nunca é bloqueada por diferença.
 *
 * p_itens: [{"item_id":"...","quantidade":8}, ...]
 */
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
  v_recebido numeric;
  v_residuo  numeric;
  v_n        integer := 0;
  v_pend     integer := 0;
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

  v_transito := public.estoque_local(v_r.unidade_id, 'TRANSITO', v_r.setor_id);
  v_pulmao   := public.estoque_local(v_r.unidade_id, 'PULMAO', v_r.setor_id);

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
    v_recebido := greatest(0, least(v_linha.informado, v_linha.qtd_separada));
    v_residuo  := v_linha.qtd_separada - v_recebido;

    if v_recebido > 0 then
      insert into public.estoque_movimentos
        (unidade_id, item_id, local_origem_id, local_destino_id, quantidade,
         fluxo, documento_tipo, documento_id, registrado_por, funcao_exercida)
      values
        (v_r.unidade_id, v_linha.item_id, v_transito, v_pulmao, v_recebido,
         'ABASTECIMENTO_RECEBIMENTO', 'RODADA', p_rodada_id, auth.uid(),
         public.estoque_funcao_exercida(v_r.unidade_id));
      v_n := v_n + 1;
    end if;

    update public.estoque_rodada_itens
    set qtd_recebida = v_recebido
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

-- ---------------------------------------------------------------------------
-- Apuração
-- ---------------------------------------------------------------------------
create or replace function public.estoque_apurar_divergencia(
  p_divergencia_id uuid, p_causa text, p_motivo text default null
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_d      public.estoque_divergencias%rowtype;
  v_causa  public.estoque_causas_divergencia%rowtype;
  v_fluxo  public.estoque_fluxos%rowtype;
  v_origem uuid;
  v_destino uuid;
  v_mov    uuid;
begin
  select * into v_d from public.estoque_divergencias where id = p_divergencia_id;
  if not found then raise exception 'Divergência não encontrada.'; end if;
  if v_d.situacao = 'APURADA' then raise exception 'Divergência já apurada.'; end if;
  if not public.estoque_pode(v_d.unidade_id, 'divergencia.apurar') then
    raise exception 'Sem permissão para apurar divergência.';
  end if;

  select * into v_causa from public.estoque_causas_divergencia where codigo = p_causa;
  if not found then raise exception 'Causa desconhecida.'; end if;
  if v_causa.aplica_a <> v_d.origem then
    raise exception 'A causa "%" não se aplica a divergência de origem %.',
      v_causa.nome, v_d.origem;
  end if;
  if v_causa.exige_motivo and coalesce(trim(p_motivo), '') = '' then
    raise exception 'A causa "%" exige motivo.', v_causa.nome;
  end if;

  if v_causa.fluxo_destino is not null then
    select * into v_fluxo from public.estoque_fluxos where codigo = v_causa.fluxo_destino;

    v_origem := public.estoque_local(v_d.unidade_id, v_fluxo.origem_tipo, v_d.setor_id);
    v_destino := case
      when v_fluxo.destino_tipo is null then null
      else public.estoque_local(v_d.unidade_id, v_fluxo.destino_tipo, v_d.setor_id)
    end;

    insert into public.estoque_movimentos
      (unidade_id, item_id, local_origem_id, local_destino_id, quantidade,
       fluxo, documento_tipo, documento_id, registrado_por, funcao_exercida)
    values
      (v_d.unidade_id, v_d.item_id, v_origem, v_destino, v_d.quantidade,
       v_causa.fluxo_destino, 'DIVERGENCIA', p_divergencia_id, auth.uid(),
       public.estoque_funcao_exercida(v_d.unidade_id))
    returning id into v_mov;
  end if;

  update public.estoque_divergencias
  set situacao = 'APURADA', causa = p_causa, motivo = p_motivo,
      apurado_por = auth.uid(), apurado_em = now()
  where id = p_divergencia_id;

  perform public.estoque_registrar_evento(
    v_d.unidade_id, 'DIVERGENCIA_APURADA', 'DIVERGENCIA', p_divergencia_id,
    jsonb_build_object('situacao', 'PENDENTE'),
    jsonb_build_object('causa', p_causa, 'quantidade', v_d.quantidade),
    v_mov, p_motivo);

  return v_mov;
end;
$$;

-- ---------------------------------------------------------------------------
-- Inventário de implantação
-- ---------------------------------------------------------------------------
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
  v_inv       uuid;
  v_principal uuid;
  v_linha     jsonb;
  v_item      uuid;
  v_qtd       numeric;
  v_n         integer := 0;
  v_nome      text;
begin
  if not public.estoque_pode(p_unidade_id, 'saldo_inicial.lancar') then
    raise exception 'Sem permissão para lançar inventário de implantação.';
  end if;

  if exists (select 1 from public.estoque_unidade_config
             where unidade_id = p_unidade_id and em_producao) then
    raise exception
      'Unidade já está em produção. Saldo não se digita mais: use os fluxos de movimentação.';
  end if;

  v_principal := public.estoque_local(p_unidade_id, 'PRINCIPAL');

  insert into public.estoque_inventarios (unidade_id, data_referencia, responsavel, observacao)
  values (p_unidade_id, p_data, auth.uid(), p_observacao)
  returning id into v_inv;

  for v_linha in select * from jsonb_array_elements(coalesce(p_itens, '[]'::jsonb))
  loop
    v_item := (v_linha ->> 'item_id')::uuid;
    v_qtd  := (v_linha ->> 'quantidade')::numeric;
    if v_qtd is null or v_qtd <= 0 then continue; end if;

    if exists (
      select 1 from public.estoque_movimentos
      where fluxo = 'SALDO_INICIAL' and item_id = v_item and local_destino_id = v_principal
    ) then
      select nome into v_nome from public.estoque_itens where id = v_item;
      raise exception 'Já existe saldo inicial lançado para "%". Corrija por movimentação.', v_nome;
    end if;

    insert into public.estoque_inventario_itens (inventario_id, local_id, item_id, quantidade)
    values (v_inv, v_principal, v_item, v_qtd);

    insert into public.estoque_movimentos
      (unidade_id, item_id, local_origem_id, local_destino_id, quantidade,
       fluxo, documento_tipo, documento_id, registrado_por, funcao_exercida)
    values
      (p_unidade_id, v_item, null, v_principal, v_qtd,
       'SALDO_INICIAL', 'INVENTARIO', v_inv, auth.uid(),
       public.estoque_funcao_exercida(p_unidade_id));

    v_n := v_n + 1;
  end loop;

  perform public.estoque_registrar_evento(
    p_unidade_id, 'INVENTARIO_IMPLANTACAO', 'INVENTARIO', v_inv, null,
    jsonb_build_object('itens', v_n, 'data_referencia', p_data), null, p_observacao);

  return jsonb_build_object('inventario_id', v_inv, 'itens', v_n);
end;
$$;
