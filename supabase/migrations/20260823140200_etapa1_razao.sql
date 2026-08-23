-- ============================================================================
-- ETAPA 1 · Parte 3/6 — Razão de movimentações e trilha de eventos
-- ============================================================================
-- P1 — Não existe transferência livre entre locais.
--      Cada movimento nasce de um FLUXO nomeado, e o par (tipo de origem,
--      tipo de destino) de cada fluxo é declarado como dado e verificado por
--      trigger. Ninguém consegue, no futuro, criar um botão "Transferir" e
--      contornar a regra: o banco recusa o par que não pertence a um fluxo.
--
-- P2 — Razão e trilha são coisas separadas. O razão só recebe o que altera
--      saldo. A trilha recebe todo evento relevante — inclusive os que nunca
--      tocam saldo, como uma solicitação negada ou uma troca de parâmetro.
--
-- P3 — Saldo é sempre derivado. Não há tabela de saldo para digitar.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Catálogo de fluxos permitidos
-- ---------------------------------------------------------------------------
create table if not exists public.estoque_fluxos (
  codigo       text primary key,
  nome         text not null,
  origem_tipo  text,   -- null = entra de fora do sistema
  destino_tipo text,   -- null = sai do sistema
  descricao    text,
  constraint estoque_fluxos_tem_perna check (
    origem_tipo is not null or destino_tipo is not null
  )
);

insert into public.estoque_fluxos (codigo, nome, origem_tipo, destino_tipo, descricao) values
  ('SALDO_INICIAL', 'Inventário de implantação', null, 'PRINCIPAL',
   'Única porta de entrada de saldo sem movimento anterior. Bloqueada depois que a unidade entra em produção.'),

  ('ABASTECIMENTO_SEPARACAO', 'Separação para o pulmão', 'PRINCIPAL', 'TRANSITO',
   'O Gerente de CPD separa e deixa na porta. Sai da custódia do principal e ainda não é do setor.'),

  ('ABASTECIMENTO_RECEBIMENTO', 'Recebimento no pulmão', 'TRANSITO', 'PULMAO',
   'O líder confirma o que efetivamente recebeu. O que não for confirmado permanece em trânsito.'),

  ('APURACAO_CORRECAO_REGISTRO', 'Correção de registro na apuração', 'TRANSITO', 'PRINCIPAL',
   'Só quando a apuração comprova que a mercadoria NUNCA saiu fisicamente. Não é reentrada: é correção de lançamento errado (L12).'),

  ('APURACAO_RECEBIMENTO_COMPLEMENTAR', 'Recebimento complementar', 'TRANSITO', 'PULMAO',
   'Mercadoria que saiu, ficou na porta e foi recolhida depois, ou erro de conferência no recebimento.'),

  ('APURACAO_PERDA_TRANSITO', 'Perda em trânsito', 'TRANSITO', null,
   'Rotina mínima de perda, restrita à apuração de resíduo. NÃO é o módulo de perdas (M5).'),

  ('FECHAMENTO_PULMAO_SOND', 'Saída operacional não discriminada', 'PULMAO', null,
   'Fecha o ciclo do pulmão pela contagem física. Enquanto o fluxo Pulmão -> Praça não existir, esta é a saída agregada do ciclo. NÃO é perda, NÃO é divergência e NÃO deve gerar alerta por magnitude.')
on conflict (codigo) do nothing;

-- ---------------------------------------------------------------------------
-- Razão
-- ---------------------------------------------------------------------------
create table if not exists public.estoque_movimentos (
  id               uuid primary key default gen_random_uuid(),
  unidade_id       uuid not null references public.unidades (id),
  item_id          uuid not null references public.estoque_itens (id),
  local_origem_id  uuid references public.estoque_locais (id),
  local_destino_id uuid references public.estoque_locais (id),
  quantidade       numeric(14,3) not null,
  fluxo            text not null references public.estoque_fluxos (codigo),

  -- De qual documento de negócio este movimento nasceu.
  documento_tipo   text not null,
  documento_id     uuid,

  momento          timestamptz not null default now(),
  registrado_por   uuid not null references auth.users (id),
  funcao_exercida  text references public.estoque_funcoes (codigo),
  estorno_de       uuid references public.estoque_movimentos (id),
  criado_em        timestamptz not null default now(),

  constraint estoque_movimentos_qtd_positiva check (quantidade > 0),
  constraint estoque_movimentos_tem_perna check (
    local_origem_id is not null or local_destino_id is not null
  ),
  constraint estoque_movimentos_nao_circular check (
    local_origem_id is null
    or local_destino_id is null
    or local_origem_id <> local_destino_id
  )
);

create index if not exists estoque_movimentos_saldo_idx
  on public.estoque_movimentos (unidade_id, item_id);
create index if not exists estoque_movimentos_origem_idx
  on public.estoque_movimentos (local_origem_id) where local_origem_id is not null;
create index if not exists estoque_movimentos_destino_idx
  on public.estoque_movimentos (local_destino_id) where local_destino_id is not null;
create index if not exists estoque_movimentos_documento_idx
  on public.estoque_movimentos (documento_tipo, documento_id);
create unique index if not exists estoque_movimentos_estorno_unico
  on public.estoque_movimentos (estorno_de) where estorno_de is not null;

-- ---------------------------------------------------------------------------
-- A trava do P1: o par de locais tem de pertencer ao fluxo declarado
-- ---------------------------------------------------------------------------
create or replace function public.estoque_valida_movimento()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_fluxo    public.estoque_fluxos%rowtype;
  v_origem   text;
  v_destino  text;
  v_orig     public.estoque_movimentos%rowtype;
begin
  select * into v_fluxo from public.estoque_fluxos where codigo = new.fluxo;

  select tipo into v_origem  from public.estoque_locais where id = new.local_origem_id;
  select tipo into v_destino from public.estoque_locais where id = new.local_destino_id;

  if new.estorno_de is not null then
    -- Estorno é o espelho exato do movimento original: mesmo fluxo, mesma
    -- quantidade, pernas trocadas. Nada é apagado (RB-011).
    select * into v_orig from public.estoque_movimentos where id = new.estorno_de;
    if not found then
      raise exception 'Movimento de origem do estorno não existe.';
    end if;
    if v_orig.estorno_de is not null then
      raise exception 'Não se estorna um estorno.';
    end if;
    if new.fluxo <> v_orig.fluxo or new.quantidade <> v_orig.quantidade
       or new.item_id <> v_orig.item_id
       or coalesce(new.local_origem_id, '00000000-0000-0000-0000-000000000000'::uuid)
          <> coalesce(v_orig.local_destino_id, '00000000-0000-0000-0000-000000000000'::uuid)
       or coalesce(new.local_destino_id, '00000000-0000-0000-0000-000000000000'::uuid)
          <> coalesce(v_orig.local_origem_id, '00000000-0000-0000-0000-000000000000'::uuid) then
      raise exception 'O estorno deve espelhar exatamente o movimento original.';
    end if;
    return new;
  end if;

  if v_origem is distinct from v_fluxo.origem_tipo then
    raise exception
      'Fluxo % exige origem % e recebeu %. Movimento fora de fluxo nomeado é proibido.',
      new.fluxo, coalesce(v_fluxo.origem_tipo, '(fora do sistema)'), coalesce(v_origem, '(nenhuma)');
  end if;

  if v_destino is distinct from v_fluxo.destino_tipo then
    raise exception
      'Fluxo % exige destino % e recebeu %. Movimento fora de fluxo nomeado é proibido.',
      new.fluxo, coalesce(v_fluxo.destino_tipo, '(fora do sistema)'), coalesce(v_destino, '(nenhum)');
  end if;

  return new;
end;
$$;

drop trigger if exists estoque_movimentos_valida on public.estoque_movimentos;
create trigger estoque_movimentos_valida
  before insert on public.estoque_movimentos
  for each row execute function public.estoque_valida_movimento();

-- Imutabilidade
create or replace function public.estoque_bloqueia_alteracao()
returns trigger
language plpgsql
as $$
begin
  raise exception
    '% é imutável. Correção se faz por estorno ou apuração, nunca apagando.',
    tg_table_name;
end;
$$;

drop trigger if exists estoque_movimentos_imutavel on public.estoque_movimentos;
create trigger estoque_movimentos_imutavel
  before update or delete on public.estoque_movimentos
  for each row execute function public.estoque_bloqueia_alteracao();

-- ---------------------------------------------------------------------------
-- Trilha de eventos — o que aconteceu, altere saldo ou não (P2)
-- ---------------------------------------------------------------------------
create table if not exists public.estoque_eventos (
  id                uuid primary key default gen_random_uuid(),
  unidade_id        uuid not null references public.unidades (id),
  tipo              text not null,
  ator              uuid references auth.users (id),
  funcao_exercida   text references public.estoque_funcoes (codigo),
  momento           timestamptz not null default now(),
  entidade_tipo     text,
  entidade_id       uuid,
  dados_anteriores  jsonb,
  dados_novos       jsonb,
  movimento_id      uuid references public.estoque_movimentos (id),
  observacao        text
);

create index if not exists estoque_eventos_unidade_momento_idx
  on public.estoque_eventos (unidade_id, momento desc);
create index if not exists estoque_eventos_entidade_idx
  on public.estoque_eventos (entidade_tipo, entidade_id);
create index if not exists estoque_eventos_ator_idx
  on public.estoque_eventos (ator, momento desc);

drop trigger if exists estoque_eventos_imutavel on public.estoque_eventos;
create trigger estoque_eventos_imutavel
  before update or delete on public.estoque_eventos
  for each row execute function public.estoque_bloqueia_alteracao();

/** Registra um evento na trilha. Usada por todos os fluxos. */
create or replace function public.estoque_registrar_evento(
  p_unidade_id    uuid,
  p_tipo          text,
  p_entidade_tipo text default null,
  p_entidade_id   uuid default null,
  p_anteriores    jsonb default null,
  p_novos         jsonb default null,
  p_movimento_id  uuid default null,
  p_observacao    text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  insert into public.estoque_eventos
    (unidade_id, tipo, ator, funcao_exercida, entidade_tipo, entidade_id,
     dados_anteriores, dados_novos, movimento_id, observacao)
  values
    (p_unidade_id, p_tipo, auth.uid(),
     public.estoque_funcao_exercida(p_unidade_id),
     p_entidade_tipo, p_entidade_id, p_anteriores, p_novos, p_movimento_id, p_observacao)
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Saldos — derivados (P3)
-- ---------------------------------------------------------------------------
create or replace view public.estoque_saldos_locais as
with pernas as (
  select unidade_id, item_id, local_destino_id as local_id, quantidade as delta
  from public.estoque_movimentos
  where local_destino_id is not null
  union all
  select unidade_id, item_id, local_origem_id as local_id, -quantidade
  from public.estoque_movimentos
  where local_origem_id is not null
)
select
  p.unidade_id,
  p.local_id,
  p.item_id,
  sum(p.delta) as quantidade,
  max(m.ultimo) as ultimo_movimento
from pernas p
left join (
  select unidade_id, item_id, max(momento) as ultimo
  from public.estoque_movimentos group by 1,2
) m on m.unidade_id = p.unidade_id and m.item_id = p.item_id
group by p.unidade_id, p.local_id, p.item_id
having sum(p.delta) <> 0;

-- Lição já aprendida neste banco: view roda com permissão do DONO por padrão
-- e ignora a RLS das tabelas de baixo.
alter view public.estoque_saldos_locais set (security_invoker = true);

/** Saldo de um item num local específico. Usada pelos fluxos antes de baixar. */
create or replace function public.estoque_saldo_em(p_local_id uuid, p_item_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select sum(case when m.local_destino_id = p_local_id then m.quantidade else -m.quantidade end)
    from public.estoque_movimentos m
    where m.item_id = p_item_id
      and (m.local_destino_id = p_local_id or m.local_origem_id = p_local_id)
  ), 0)
$$;
