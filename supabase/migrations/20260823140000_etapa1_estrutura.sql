-- ============================================================================
-- ETAPA 1 · Parte 1/6 — Estrutura: setores, locais e itens
-- ============================================================================
-- Substitui o modelo anterior, que conflava pulmão e praça num único bucket.
-- O Contexto Mestre (§3.1) exige três camadas de armazenamento, e a Etapa 1
-- acrescenta uma quarta que o documento descreve sem nomear: o intervalo em
-- que a mercadoria separada está na porta, fora da custódia de qualquer um.
-- Sem esse local, a divergência entre separado e recebido não teria onde
-- existir e simplesmente desapareceria do razão.
--
-- Nada é destruído aqui. Os 87 itens e o saldo inicial já lançados são
-- migrados na parte 6.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Setores  (§3.2 — seis, não quatro)
-- ---------------------------------------------------------------------------
create table if not exists public.estoque_setores (
  id         uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references public.unidades (id),
  nome       text not null,
  codigo     text not null,
  ordem      integer not null default 0,
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now(),
  constraint estoque_setores_codigo_unico unique (unidade_id, codigo)
);

comment on table public.estoque_setores is
  'Setores que consomem do estoque. Cada um tem pulmão, praça e trânsito próprios.';

-- ---------------------------------------------------------------------------
-- Locais de estoque — as camadas
-- ---------------------------------------------------------------------------
create table if not exists public.estoque_locais (
  id         uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references public.unidades (id),
  setor_id   uuid references public.estoque_setores (id),
  tipo       text not null,
  nome       text not null,
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now(),

  constraint estoque_locais_tipo_valido
    check (tipo in ('PRINCIPAL','TRANSITO','PULMAO','PRACA')),

  -- O principal é da casa; os outros três são sempre de um setor.
  constraint estoque_locais_setor_coerente check (
    (tipo = 'PRINCIPAL' and setor_id is null)
    or (tipo <> 'PRINCIPAL' and setor_id is not null)
  )
);

-- Um principal por unidade; um de cada tipo por setor.
create unique index if not exists estoque_locais_principal_unico
  on public.estoque_locais (unidade_id) where tipo = 'PRINCIPAL';
create unique index if not exists estoque_locais_setor_tipo_unico
  on public.estoque_locais (unidade_id, setor_id, tipo) where setor_id is not null;

comment on column public.estoque_locais.tipo is
  'PRINCIPAL: custódia central. TRANSITO: separado na porta, aguardando o líder. PULMAO: reserva do setor. PRACA: uso diário (sem saldo na Etapa 1).';

-- ---------------------------------------------------------------------------
-- Itens
-- ---------------------------------------------------------------------------
create table if not exists public.estoque_itens (
  id         uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references public.unidades (id),
  nome       text not null,
  categoria  text,

  -- §11: o erro recorrente não é só contar quantidade errada, é contar na
  -- unidade errada. A orientação existe para ser mostrada a quem conta.
  unidade_contagem   text not null default 'un',
  orientacao_contagem text,

  -- §12.3: a lista de itens críticos deve evoluir com dado real.
  critico    boolean not null default false,

  ean        text,
  custo_medio numeric(14,4) not null default 0,
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  constraint estoque_itens_nome_unico unique (unidade_id, nome)
);

create index if not exists estoque_itens_unidade_idx
  on public.estoque_itens (unidade_id) where ativo;

comment on column public.estoque_itens.orientacao_contagem is
  'Texto mostrado a quem conta, ex.: "conte em caixas — caixa com 4 pacotes de 500 un". Não há motor de conversão: o Contexto Mestre (§11) diz que não é necessário agora.';
