-- ============================================================================
-- ETAPA 1 · Parte 4/6 — Parâmetros e governança
-- ============================================================================
-- Dois mínimos DISTINTOS (§6.2). O documento usa a mesma palavra para as duas
-- coisas, e é por isso que precisam nomes diferentes aqui:
--
--   mínimo do pulmão  → (unidade, setor, item). Dirige a separação diária.
--   mínimo da casa    → (unidade, item). Comparado com praça+pulmão+principal
--                       para decidir o pedido. Consumido no M11.
--
-- Governança (RB-024, §15): direção e Gerente de CPD definem; demais líderes
-- SUGEREM. A sugestão é evento, não alteração — nunca toca o valor.
-- Toda alteração grava autor, momento, valor anterior e valor novo.
-- ============================================================================

create table if not exists public.estoque_minimo_pulmao (
  id           uuid primary key default gen_random_uuid(),
  unidade_id   uuid not null references public.unidades (id),
  setor_id     uuid not null references public.estoque_setores (id),
  item_id      uuid not null references public.estoque_itens (id),
  quantidade   numeric(14,3) not null,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users (id),
  constraint estoque_minimo_pulmao_unico unique (unidade_id, setor_id, item_id),
  constraint estoque_minimo_pulmao_nao_negativo check (quantidade >= 0)
);

create table if not exists public.estoque_minimo_casa (
  id           uuid primary key default gen_random_uuid(),
  unidade_id   uuid not null references public.unidades (id),
  item_id      uuid not null references public.estoque_itens (id),
  quantidade   numeric(14,3) not null,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users (id),
  constraint estoque_minimo_casa_unico unique (unidade_id, item_id),
  constraint estoque_minimo_casa_nao_negativo check (quantidade >= 0)
);

create table if not exists public.estoque_parametro_sugestoes (
  id             uuid primary key default gen_random_uuid(),
  unidade_id     uuid not null references public.unidades (id),
  parametro      text not null,
  setor_id       uuid references public.estoque_setores (id),
  item_id        uuid not null references public.estoque_itens (id),
  valor_atual    numeric(14,3),
  valor_proposto numeric(14,3) not null,
  motivo         text not null,
  situacao       text not null default 'PENDENTE',
  autor          uuid not null references auth.users (id),
  funcao_exercida text references public.estoque_funcoes (codigo),
  criado_em      timestamptz not null default now(),
  decidido_por   uuid references auth.users (id),
  decidido_em    timestamptz,
  decisao_motivo text,
  constraint estoque_sugestao_parametro_valido
    check (parametro in ('MINIMO_PULMAO','MINIMO_CASA')),
  constraint estoque_sugestao_situacao_valida
    check (situacao in ('PENDENTE','ACEITA','RECUSADA')),
  -- Mínimo de pulmão é por setor; mínimo da casa não tem setor.
  constraint estoque_sugestao_escopo_coerente check (
    (parametro = 'MINIMO_PULMAO' and setor_id is not null)
    or (parametro = 'MINIMO_CASA' and setor_id is null)
  )
);

-- ---------------------------------------------------------------------------
-- Escrita — só por função. As tabelas não terão policy de INSERT/UPDATE.
-- ---------------------------------------------------------------------------

create or replace function public.estoque_definir_minimo_pulmao(
  p_unidade_id   uuid,
  p_setor_id     uuid,
  p_item_id      uuid,
  p_quantidade   numeric,
  p_justificativa text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_anterior numeric;
  v_id       uuid;
begin
  if not public.estoque_pode(p_unidade_id, 'parametro.minimo_pulmao.definir') then
    raise exception 'Sem permissão para definir o mínimo do pulmão. Líderes podem sugerir.';
  end if;
  if p_quantidade is null or p_quantidade < 0 then
    raise exception 'Quantidade inválida.';
  end if;

  select quantidade into v_anterior
  from public.estoque_minimo_pulmao
  where unidade_id = p_unidade_id and setor_id = p_setor_id and item_id = p_item_id;

  insert into public.estoque_minimo_pulmao
    (unidade_id, setor_id, item_id, quantidade, atualizado_por)
  values (p_unidade_id, p_setor_id, p_item_id, p_quantidade, auth.uid())
  on conflict (unidade_id, setor_id, item_id) do update
    set quantidade = excluded.quantidade,
        atualizado_em = now(),
        atualizado_por = auth.uid()
  returning id into v_id;

  perform public.estoque_registrar_evento(
    p_unidade_id, 'PARAMETRO_ALTERADO', 'MINIMO_PULMAO', v_id,
    jsonb_build_object('quantidade', v_anterior),
    jsonb_build_object('quantidade', p_quantidade,
                       'setor_id', p_setor_id, 'item_id', p_item_id),
    null, p_justificativa
  );

  return v_id;
end;
$$;

create or replace function public.estoque_definir_minimo_casa(
  p_unidade_id   uuid,
  p_item_id      uuid,
  p_quantidade   numeric,
  p_justificativa text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_anterior numeric;
  v_id       uuid;
begin
  if not public.estoque_pode(p_unidade_id, 'parametro.minimo_casa.definir') then
    raise exception 'Sem permissão para definir o mínimo da casa. Líderes podem sugerir.';
  end if;
  if p_quantidade is null or p_quantidade < 0 then
    raise exception 'Quantidade inválida.';
  end if;

  select quantidade into v_anterior
  from public.estoque_minimo_casa
  where unidade_id = p_unidade_id and item_id = p_item_id;

  insert into public.estoque_minimo_casa (unidade_id, item_id, quantidade, atualizado_por)
  values (p_unidade_id, p_item_id, p_quantidade, auth.uid())
  on conflict (unidade_id, item_id) do update
    set quantidade = excluded.quantidade,
        atualizado_em = now(),
        atualizado_por = auth.uid()
  returning id into v_id;

  perform public.estoque_registrar_evento(
    p_unidade_id, 'PARAMETRO_ALTERADO', 'MINIMO_CASA', v_id,
    jsonb_build_object('quantidade', v_anterior),
    jsonb_build_object('quantidade', p_quantidade, 'item_id', p_item_id),
    null, p_justificativa
  );

  return v_id;
end;
$$;

/** Sugestão de alteração. Não toca o parâmetro — é só evento (RB-024). */
create or replace function public.estoque_sugerir_minimo(
  p_unidade_id     uuid,
  p_parametro      text,
  p_item_id        uuid,
  p_valor_proposto numeric,
  p_motivo         text,
  p_setor_id       uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_atual numeric;
  v_id    uuid;
begin
  if not public.estoque_pode(p_unidade_id, 'parametro.sugerir') then
    raise exception 'Sem permissão para sugerir alteração de mínimo.';
  end if;
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'A sugestão exige motivo.';
  end if;

  if p_parametro = 'MINIMO_PULMAO' then
    select quantidade into v_atual from public.estoque_minimo_pulmao
    where unidade_id = p_unidade_id and setor_id = p_setor_id and item_id = p_item_id;
  else
    select quantidade into v_atual from public.estoque_minimo_casa
    where unidade_id = p_unidade_id and item_id = p_item_id;
  end if;

  insert into public.estoque_parametro_sugestoes
    (unidade_id, parametro, setor_id, item_id, valor_atual, valor_proposto,
     motivo, autor, funcao_exercida)
  values
    (p_unidade_id, p_parametro, p_setor_id, p_item_id, v_atual, p_valor_proposto,
     p_motivo, auth.uid(), public.estoque_funcao_exercida(p_unidade_id))
  returning id into v_id;

  perform public.estoque_registrar_evento(
    p_unidade_id, 'PARAMETRO_SUGERIDO', p_parametro, v_id, null,
    jsonb_build_object('valor_atual', v_atual, 'valor_proposto', p_valor_proposto),
    null, p_motivo
  );

  return v_id;
end;
$$;
