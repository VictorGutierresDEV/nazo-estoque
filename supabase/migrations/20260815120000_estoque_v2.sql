-- ============================================================================
-- Nazo Estoque V2 — razão de movimentos de estoque
-- ============================================================================
-- Convive com o schema do nazo-gestao no mesmo projeto Supabase. Todas as
-- tabelas usam o prefixo estoque_ e NENHUMA tabela existente é alterada.
--
-- Duas lições da auditoria do vStoque, que morreu na operação:
--
--   1. Lá, quem retirava o item era `saidas.solicitante TEXT` — texto livre.
--      Aqui, `retirado_por` é chave estrangeira para colaboradores e o banco
--      RECUSA uma saída sem responsável. Não é validação de tela: é constraint.
--
--   2. Lá, o setor era ENUM. Criar praça nova exigia migration. Aqui praça é
--      tabela.
--
-- Modelo: razão de partidas (ledger). `estoque_transacoes` é o documento e
-- `estoque_lancamentos` são as pernas. Saldo de qualquer bucket é
-- sum(delta) — sem ramificar por tipo, que é onde esse tipo de sistema
-- costuma criar bug. praca_id NULL = Estoque Central (o estoque trancado).
--
-- Uma saída do Central para o Sushi grava duas pernas:
--     (praca_id = NULL,  delta = -5)   sai do Central
--     (praca_id = sushi, delta = +5)   entra no pulmão do Sushi
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Helpers de acesso
-- ---------------------------------------------------------------------------
-- Espelham o padrão que o nazo-gestao já usa (profiles.unidade_ativa +
-- acesso_todas_unidades). Prefixados para nunca colidir com funções de lá.

create or replace function public.estoque_unidade_atual()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(p.unidade_ativa, p.unidade_id)
  from public.profiles p
  where p.id = auth.uid()
$$;

create or replace function public.estoque_pode_ver(p_unidade_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        coalesce(p.acesso_todas_unidades, false)
        or coalesce(p.unidade_ativa, p.unidade_id) = p_unidade_id
      )
  )
$$;

-- Quem pode OPERAR o estoque (registrar entrada/saída).
-- A regra de negócio: o acesso ao estoque é restrito. Só quem tem papel de
-- gestão ou está explicitamente liberado registra movimento.
create or replace function public.estoque_pode_operar(p_unidade_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.ativo, true)
      and p.role in ('owner', 'manager', 'leader', 'subleader', 'estoque')
      and (
        coalesce(p.acesso_todas_unidades, false)
        or coalesce(p.unidade_ativa, p.unidade_id) = p_unidade_id
      )
  )
$$;

-- ---------------------------------------------------------------------------
-- 2. Praças  (o que no vStoque era ENUM e travava a operação)
-- ---------------------------------------------------------------------------
create table if not exists public.estoque_pracas (
  id          uuid primary key default gen_random_uuid(),
  unidade_id  uuid not null,
  nome        text not null,
  codigo      text not null,
  ordem       integer not null default 0,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint estoque_pracas_codigo_unico unique (unidade_id, codigo)
);

comment on table public.estoque_pracas is
  'Praças/setores que consomem do estoque. Cada praça tem seu estoque pulmão.';

-- ---------------------------------------------------------------------------
-- 3. Produtos
-- ---------------------------------------------------------------------------
create table if not exists public.estoque_produtos (
  id             uuid primary key default gen_random_uuid(),
  unidade_id     uuid not null,
  nome           text not null,
  categoria      text,
  unidade_medida text not null default 'un',
  estoque_minimo numeric(14,3) not null default 0,
  -- Custo médio móvel, recalculado a cada entrada. É o que valoriza a saída
  -- em R$ e liga este app ao CMV.
  custo_medio    numeric(14,4) not null default 0,
  ean            text,
  ativo          boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint estoque_produtos_nome_unico unique (unidade_id, nome)
);

create index if not exists estoque_produtos_unidade_idx
  on public.estoque_produtos (unidade_id) where ativo;

-- ---------------------------------------------------------------------------
-- 4. Transações — o documento
-- ---------------------------------------------------------------------------
create table if not exists public.estoque_transacoes (
  id             uuid primary key default gen_random_uuid(),
  unidade_id     uuid not null,
  tipo           text not null,
  ocorrido_em    timestamptz not null default now(),

  -- Quem OPEROU o app (o responsável do estoque).
  registrado_por uuid not null references auth.users (id),
  -- Quem LEVOU o item. FK real para o cadastro de colaboradores: é isto que
  -- o vStoque não tinha e que fez o registro perder valor.
  retirado_por   uuid,
  -- Praça de destino da saída (ou de origem da devolução).
  praca_id       uuid references public.estoque_pracas (id),

  fornecedor     text,
  documento      text,
  motivo         text,
  observacao     text,

  -- Nada é apagado nem editado. Correção gera transação de estorno.
  estorno_de     uuid references public.estoque_transacoes (id),

  created_at     timestamptz not null default now(),

  constraint estoque_transacoes_tipo_valido check (
    tipo in ('ENTRADA','SAIDA','DEVOLUCAO','PERDA','AJUSTE','TRANSFERENCIA')
  ),

  -- ####################################################################
  -- A constraint que resolve o problema do usuário: é fisicamente
  -- impossível gravar uma saída anônima ou sem destino.
  -- ####################################################################
  constraint estoque_saida_exige_responsavel check (
    tipo <> 'SAIDA'
    or (retirado_por is not null and praca_id is not null)
  ),

  constraint estoque_perda_exige_motivo check (
    tipo <> 'PERDA' or motivo is not null
  )
);

create index if not exists estoque_transacoes_unidade_data_idx
  on public.estoque_transacoes (unidade_id, ocorrido_em desc);
create index if not exists estoque_transacoes_retirado_idx
  on public.estoque_transacoes (retirado_por) where retirado_por is not null;
create index if not exists estoque_transacoes_estorno_idx
  on public.estoque_transacoes (estorno_de) where estorno_de is not null;

-- ---------------------------------------------------------------------------
-- 5. Lançamentos — as pernas do razão
-- ---------------------------------------------------------------------------
create table if not exists public.estoque_lancamentos (
  id             uuid primary key default gen_random_uuid(),
  transacao_id   uuid not null references public.estoque_transacoes (id),
  unidade_id     uuid not null,
  produto_id     uuid not null references public.estoque_produtos (id),
  -- NULL = Estoque Central. Preenchido = pulmão daquela praça.
  praca_id       uuid references public.estoque_pracas (id),
  delta          numeric(14,3) not null,
  custo_unitario numeric(14,4) not null default 0,
  created_at     timestamptz not null default now(),

  constraint estoque_lancamentos_delta_nao_zero check (delta <> 0)
);

create index if not exists estoque_lancamentos_saldo_idx
  on public.estoque_lancamentos (unidade_id, produto_id, praca_id);
create index if not exists estoque_lancamentos_transacao_idx
  on public.estoque_lancamentos (transacao_id);

-- ---------------------------------------------------------------------------
-- 6. Imutabilidade do razão
-- ---------------------------------------------------------------------------
create or replace function public.estoque_bloqueia_alteracao()
returns trigger
language plpgsql
as $$
begin
  raise exception
    'O razão de estoque é imutável. Para corrigir, registre um estorno (tabela %).',
    tg_table_name;
end;
$$;

drop trigger if exists estoque_lancamentos_imutavel on public.estoque_lancamentos;
create trigger estoque_lancamentos_imutavel
  before update or delete on public.estoque_lancamentos
  for each row execute function public.estoque_bloqueia_alteracao();

drop trigger if exists estoque_transacoes_imutavel on public.estoque_transacoes;
create trigger estoque_transacoes_imutavel
  before update or delete on public.estoque_transacoes
  for each row execute function public.estoque_bloqueia_alteracao();

-- ---------------------------------------------------------------------------
-- 7. Saldos — derivados, nunca digitados
-- ---------------------------------------------------------------------------
create or replace view public.estoque_saldos as
  select
    l.unidade_id,
    l.produto_id,
    l.praca_id,
    sum(l.delta) as quantidade,
    max(l.created_at) as ultimo_movimento
  from public.estoque_lancamentos l
  group by l.unidade_id, l.produto_id, l.praca_id
  having sum(l.delta) <> 0;

comment on view public.estoque_saldos is
  'Saldo por bucket. praca_id NULL = Estoque Central. Derivado do razão.';

-- Extrato legível para a tela de histórico.
create or replace view public.estoque_extrato as
  select
    t.id            as transacao_id,
    t.unidade_id,
    t.tipo,
    t.ocorrido_em,
    t.observacao,
    t.motivo,
    t.fornecedor,
    t.documento,
    t.estorno_de,
    t.registrado_por,
    t.retirado_por,
    pr.nome         as praca_nome,
    l.produto_id,
    pd.nome         as produto_nome,
    pd.unidade_medida,
    abs(l.delta)    as quantidade,
    l.custo_unitario,
    round(abs(l.delta) * l.custo_unitario, 2) as valor,
    l.praca_id      as bucket_praca_id,
    (l.delta > 0)   as entrada
  from public.estoque_lancamentos l
  join public.estoque_transacoes t on t.id = l.transacao_id
  join public.estoque_produtos   pd on pd.id = l.produto_id
  left join public.estoque_pracas pr on pr.id = t.praca_id;

-- ---------------------------------------------------------------------------
-- 8. Escrita — só por função. O cliente nunca insere direto.
-- ---------------------------------------------------------------------------

-- ENTRADA: itens chegam ao Estoque Central e recalculam o custo médio móvel.
-- p_itens: [{"produto_id":"...","quantidade":10,"custo_unitario":12.5}, ...]
create or replace function public.estoque_registrar_entrada(
  p_unidade_id  uuid,
  p_itens       jsonb,
  p_fornecedor  text default null,
  p_documento   text default null,
  p_ocorrido_em timestamptz default now(),
  p_observacao  text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transacao_id uuid;
  v_item         jsonb;
  v_produto_id   uuid;
  v_qtd          numeric;
  v_custo        numeric;
  v_saldo_atual  numeric;
  v_custo_atual  numeric;
begin
  if not public.estoque_pode_operar(p_unidade_id) then
    raise exception 'Sem permissão para registrar movimento nesta unidade.';
  end if;

  if p_itens is null or jsonb_array_length(p_itens) = 0 then
    raise exception 'A entrada precisa de ao menos um item.';
  end if;

  insert into public.estoque_transacoes
    (unidade_id, tipo, ocorrido_em, registrado_por, fornecedor, documento, observacao)
  values
    (p_unidade_id, 'ENTRADA', p_ocorrido_em, auth.uid(), p_fornecedor, p_documento, p_observacao)
  returning id into v_transacao_id;

  for v_item in select * from jsonb_array_elements(p_itens)
  loop
    v_produto_id := (v_item ->> 'produto_id')::uuid;
    v_qtd        := (v_item ->> 'quantidade')::numeric;
    v_custo      := coalesce((v_item ->> 'custo_unitario')::numeric, 0);

    if v_qtd is null or v_qtd <= 0 then
      raise exception 'Quantidade inválida para o produto %.', v_produto_id;
    end if;

    insert into public.estoque_lancamentos
      (transacao_id, unidade_id, produto_id, praca_id, delta, custo_unitario)
    values
      (v_transacao_id, p_unidade_id, v_produto_id, null, v_qtd, v_custo);

    -- Custo médio móvel: pondera o que já havia com o que entrou.
    if v_custo > 0 then
      select coalesce(sum(delta), 0) into v_saldo_atual
      from public.estoque_lancamentos
      where produto_id = v_produto_id
        and unidade_id = p_unidade_id
        and transacao_id <> v_transacao_id;

      select custo_medio into v_custo_atual
      from public.estoque_produtos where id = v_produto_id;

      update public.estoque_produtos
      set custo_medio = case
            when v_saldo_atual <= 0 then v_custo
            else round(
              ((v_saldo_atual * coalesce(v_custo_atual, 0)) + (v_qtd * v_custo))
              / (v_saldo_atual + v_qtd), 4)
          end,
          updated_at = now()
      where id = v_produto_id;
    end if;
  end loop;

  return v_transacao_id;
end;
$$;

-- SAÍDA: do Estoque Central para o pulmão de uma praça, sempre nominal.
create or replace function public.estoque_registrar_saida(
  p_unidade_id   uuid,
  p_praca_id     uuid,
  p_retirado_por uuid,
  p_itens        jsonb,
  p_observacao   text default null,
  p_ocorrido_em  timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transacao_id uuid;
  v_item         jsonb;
  v_produto_id   uuid;
  v_qtd          numeric;
  v_custo        numeric;
  v_disponivel   numeric;
  v_nome         text;
begin
  if not public.estoque_pode_operar(p_unidade_id) then
    raise exception 'Sem permissão para registrar movimento nesta unidade.';
  end if;

  if p_retirado_por is null then
    raise exception 'Toda saída precisa registrar QUEM retirou o item.';
  end if;
  if p_praca_id is null then
    raise exception 'Toda saída precisa registrar para QUAL praça o item foi.';
  end if;
  if p_itens is null or jsonb_array_length(p_itens) = 0 then
    raise exception 'A saída precisa de ao menos um item.';
  end if;

  insert into public.estoque_transacoes
    (unidade_id, tipo, ocorrido_em, registrado_por, retirado_por, praca_id, observacao)
  values
    (p_unidade_id, 'SAIDA', p_ocorrido_em, auth.uid(), p_retirado_por, p_praca_id, p_observacao)
  returning id into v_transacao_id;

  for v_item in select * from jsonb_array_elements(p_itens)
  loop
    v_produto_id := (v_item ->> 'produto_id')::uuid;
    v_qtd        := (v_item ->> 'quantidade')::numeric;

    if v_qtd is null or v_qtd <= 0 then
      raise exception 'Quantidade inválida para o produto %.', v_produto_id;
    end if;

    select coalesce(sum(delta), 0) into v_disponivel
    from public.estoque_lancamentos
    where produto_id = v_produto_id
      and unidade_id = p_unidade_id
      and praca_id is null;

    if v_disponivel < v_qtd then
      select nome into v_nome from public.estoque_produtos where id = v_produto_id;
      raise exception
        'Saldo insuficiente de "%" no Estoque Central: disponível %, pedido %.',
        coalesce(v_nome, v_produto_id::text), v_disponivel, v_qtd;
    end if;

    select custo_medio into v_custo
    from public.estoque_produtos where id = v_produto_id;

    -- Perna 1: sai do Central.
    insert into public.estoque_lancamentos
      (transacao_id, unidade_id, produto_id, praca_id, delta, custo_unitario)
    values
      (v_transacao_id, p_unidade_id, v_produto_id, null, -v_qtd, coalesce(v_custo, 0));

    -- Perna 2: entra no pulmão da praça.
    insert into public.estoque_lancamentos
      (transacao_id, unidade_id, produto_id, praca_id, delta, custo_unitario)
    values
      (v_transacao_id, p_unidade_id, v_produto_id, p_praca_id, v_qtd, coalesce(v_custo, 0));
  end loop;

  return v_transacao_id;
end;
$$;

-- ESTORNO: nada é apagado. O estorno espelha as pernas com sinal trocado.
create or replace function public.estoque_estornar(
  p_transacao_id uuid,
  p_motivo       text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_origem  public.estoque_transacoes%rowtype;
  v_novo_id uuid;
begin
  select * into v_origem from public.estoque_transacoes where id = p_transacao_id;
  if not found then
    raise exception 'Transação não encontrada.';
  end if;
  if not public.estoque_pode_operar(v_origem.unidade_id) then
    raise exception 'Sem permissão para estornar nesta unidade.';
  end if;
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'O estorno exige motivo.';
  end if;
  if exists (select 1 from public.estoque_transacoes where estorno_de = p_transacao_id) then
    raise exception 'Esta transação já foi estornada.';
  end if;
  if v_origem.estorno_de is not null then
    raise exception 'Não se estorna um estorno.';
  end if;

  insert into public.estoque_transacoes
    (unidade_id, tipo, ocorrido_em, registrado_por, retirado_por, praca_id,
     fornecedor, documento, motivo, observacao, estorno_de)
  values
    (v_origem.unidade_id, v_origem.tipo, now(), auth.uid(), v_origem.retirado_por,
     v_origem.praca_id, v_origem.fornecedor, v_origem.documento, p_motivo,
     'Estorno da transação ' || p_transacao_id::text, p_transacao_id)
  returning id into v_novo_id;

  insert into public.estoque_lancamentos
    (transacao_id, unidade_id, produto_id, praca_id, delta, custo_unitario)
  select v_novo_id, unidade_id, produto_id, praca_id, -delta, custo_unitario
  from public.estoque_lancamentos
  where transacao_id = p_transacao_id;

  return v_novo_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. RLS — leitura escopada por unidade; escrita só pelas funções acima
-- ---------------------------------------------------------------------------
alter table public.estoque_pracas      enable row level security;
alter table public.estoque_produtos    enable row level security;
alter table public.estoque_transacoes  enable row level security;
alter table public.estoque_lancamentos enable row level security;

drop policy if exists estoque_pracas_leitura on public.estoque_pracas;
create policy estoque_pracas_leitura on public.estoque_pracas
  for select to authenticated using (public.estoque_pode_ver(unidade_id));

drop policy if exists estoque_pracas_gestao on public.estoque_pracas;
create policy estoque_pracas_gestao on public.estoque_pracas
  for all to authenticated
  using (public.estoque_pode_operar(unidade_id))
  with check (public.estoque_pode_operar(unidade_id));

drop policy if exists estoque_produtos_leitura on public.estoque_produtos;
create policy estoque_produtos_leitura on public.estoque_produtos
  for select to authenticated using (public.estoque_pode_ver(unidade_id));

drop policy if exists estoque_produtos_gestao on public.estoque_produtos;
create policy estoque_produtos_gestao on public.estoque_produtos
  for all to authenticated
  using (public.estoque_pode_operar(unidade_id))
  with check (public.estoque_pode_operar(unidade_id));

-- Razão: só leitura. Sem policy de INSERT, o cliente não grava direto —
-- toda escrita passa pelas funções SECURITY DEFINER, que validam as regras.
drop policy if exists estoque_transacoes_leitura on public.estoque_transacoes;
create policy estoque_transacoes_leitura on public.estoque_transacoes
  for select to authenticated using (public.estoque_pode_ver(unidade_id));

drop policy if exists estoque_lancamentos_leitura on public.estoque_lancamentos;
create policy estoque_lancamentos_leitura on public.estoque_lancamentos
  for select to authenticated using (public.estoque_pode_ver(unidade_id));

grant select on public.estoque_saldos  to authenticated;
grant select on public.estoque_extrato to authenticated;

-- ---------------------------------------------------------------------------
-- 10. Chaves estrangeiras para o schema do nazo-gestao
-- ---------------------------------------------------------------------------
-- Condicionais: se a tabela existir, a FK entra; se não, a migration não quebra.
do $$
begin
  if to_regclass('public.unidades') is not null then
    alter table public.estoque_pracas
      add constraint estoque_pracas_unidade_fk
      foreign key (unidade_id) references public.unidades (id);
    alter table public.estoque_produtos
      add constraint estoque_produtos_unidade_fk
      foreign key (unidade_id) references public.unidades (id);
    alter table public.estoque_transacoes
      add constraint estoque_transacoes_unidade_fk
      foreign key (unidade_id) references public.unidades (id);
    alter table public.estoque_lancamentos
      add constraint estoque_lancamentos_unidade_fk
      foreign key (unidade_id) references public.unidades (id);
  end if;

  if to_regclass('public.colaboradores') is not null then
    alter table public.estoque_transacoes
      add constraint estoque_transacoes_retirado_por_fk
      foreign key (retirado_por) references public.colaboradores (id);
  end if;
exception
  when duplicate_object then null;
end $$;
