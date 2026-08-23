-- ============================================================================
-- ETAPA 1 · Parte 2/6 — Autoridade: função operacional + permissão
-- ============================================================================
-- Dois eixos, deliberadamente separados (P4):
--
--   Função operacional  → explica QUEM a pessoa é na operação.
--   Permissão           → explica O QUE ela pode fazer no sistema.
--
-- A função tem vigência porque a pergunta "quem estava como Gerente de Back
-- naquela noite?" precisa ter resposta. E todo evento grava a função exercida
-- NO MOMENTO do ato: se dependesse de consulta posterior, uma reatribuição
-- futura reescreveria o passado.
--
-- O mapa função→permissão é DADO, não código. Conceder autoridade a alguém
-- novo nunca exige deploy.
-- ============================================================================

create table if not exists public.estoque_funcoes (
  codigo      text primary key,
  nome        text not null,
  -- Quando a pessoa acumula funções, a de maior precedência é a registrada
  -- como "função exercida" no evento.
  precedencia integer not null default 0
);

create table if not exists public.estoque_permissoes (
  codigo    text primary key,
  descricao text not null
);

create table if not exists public.estoque_funcao_permissoes (
  funcao_codigo    text not null references public.estoque_funcoes (codigo) on delete cascade,
  permissao_codigo text not null references public.estoque_permissoes (codigo) on delete cascade,
  primary key (funcao_codigo, permissao_codigo)
);

create table if not exists public.estoque_pessoa_funcoes (
  id            uuid primary key default gen_random_uuid(),
  pessoa_id     uuid not null references public.profiles (id),
  unidade_id    uuid not null references public.unidades (id),
  funcao_codigo text not null references public.estoque_funcoes (codigo),
  -- Preenchido quando a função é ligada a um setor (líder, subchefe, auxiliar).
  setor_id      uuid references public.estoque_setores (id),
  inicio        timestamptz not null default now(),
  fim           timestamptz,
  concedido_por uuid references auth.users (id),
  criado_em     timestamptz not null default now()
);

create index if not exists estoque_pessoa_funcoes_busca_idx
  on public.estoque_pessoa_funcoes (pessoa_id, unidade_id, inicio, fim);

-- Concessão direta, para o caso que a função não cobre (ex.: uma pessoa
-- específica autorizada em caráter temporário).
create table if not exists public.estoque_pessoa_permissoes (
  id               uuid primary key default gen_random_uuid(),
  pessoa_id        uuid not null references public.profiles (id),
  unidade_id       uuid not null references public.unidades (id),
  permissao_codigo text not null references public.estoque_permissoes (codigo),
  inicio           timestamptz not null default now(),
  fim              timestamptz,
  concedido_por    uuid references auth.users (id),
  motivo           text,
  criado_em        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Catálogo
-- ---------------------------------------------------------------------------
insert into public.estoque_funcoes (codigo, nome, precedencia) values
  ('DIRECAO',              'Proprietário / direção operacional', 100),
  ('GERENTE_CPD',          'Gerente de CPD',                      90),
  ('GERENTE_BACK',         'Gerente de Back',                     80),
  ('ESTOQUISTA',           'Estoquista',                          70),
  ('LIDER_SETOR',          'Líder de setor',                      60),
  ('SUBCHEFE',             'Subchefe',                            50),
  ('AUXILIAR',             'Auxiliar',                            20),
  ('ESTAGIARIO_NUTRICAO',  'Estagiário de nutrição',              10)
on conflict (codigo) do nothing;

insert into public.estoque_permissoes (codigo, descricao) values
  ('estoque.ver',                      'Consultar saldos, contagens e histórico'),
  ('pulmao.contar',                    'Preencher a contagem do pulmão do próprio setor'),
  ('pulmao.contar_qualquer',           'Contar o pulmão de qualquer setor'),
  ('pulmao.finalizar_contagem',        'Validar e finalizar a contagem, respondendo por ela'),
  ('abastecimento.separar',            'Confirmar a separação (baixa do Estoque Principal)'),
  ('abastecimento.receber',            'Confirmar o recebimento no pulmão'),
  ('divergencia.apurar',               'Apurar resíduo pendente em trânsito'),
  ('parametro.minimo_pulmao.definir',  'Definir o mínimo do pulmão por setor/item'),
  ('parametro.minimo_casa.definir',    'Definir o mínimo global da casa por item'),
  ('parametro.sugerir',                'Sugerir alteração de mínimo'),
  ('saldo_inicial.lancar',             'Lançar inventário de implantação'),
  ('funcao.atribuir',                  'Atribuir função operacional a uma pessoa'),
  ('permissao.conceder',               'Conceder permissão direta a uma pessoa')
on conflict (codigo) do nothing;

-- Mapa inicial. RB-024 aparece aqui: líder e subchefe têm parametro.sugerir,
-- e NÃO têm parametro.*.definir.
insert into public.estoque_funcao_permissoes (funcao_codigo, permissao_codigo)
select f, p from (values
  ('DIRECAO','estoque.ver'),('DIRECAO','pulmao.contar'),('DIRECAO','pulmao.contar_qualquer'),
  ('DIRECAO','pulmao.finalizar_contagem'),('DIRECAO','abastecimento.separar'),
  ('DIRECAO','abastecimento.receber'),('DIRECAO','divergencia.apurar'),
  ('DIRECAO','parametro.minimo_pulmao.definir'),('DIRECAO','parametro.minimo_casa.definir'),
  ('DIRECAO','saldo_inicial.lancar'),('DIRECAO','funcao.atribuir'),('DIRECAO','permissao.conceder'),

  ('GERENTE_CPD','estoque.ver'),('GERENTE_CPD','pulmao.contar'),
  ('GERENTE_CPD','pulmao.contar_qualquer'),('GERENTE_CPD','pulmao.finalizar_contagem'),
  ('GERENTE_CPD','abastecimento.separar'),('GERENTE_CPD','abastecimento.receber'),
  ('GERENTE_CPD','divergencia.apurar'),('GERENTE_CPD','parametro.minimo_pulmao.definir'),
  ('GERENTE_CPD','parametro.minimo_casa.definir'),('GERENTE_CPD','saldo_inicial.lancar'),
  ('GERENTE_CPD','funcao.atribuir'),

  ('GERENTE_BACK','estoque.ver'),('GERENTE_BACK','abastecimento.separar'),
  ('GERENTE_BACK','divergencia.apurar'),('GERENTE_BACK','pulmao.contar_qualquer'),

  ('ESTOQUISTA','estoque.ver'),('ESTOQUISTA','abastecimento.separar'),
  ('ESTOQUISTA','divergencia.apurar'),('ESTOQUISTA','saldo_inicial.lancar'),

  ('LIDER_SETOR','estoque.ver'),('LIDER_SETOR','pulmao.contar'),
  ('LIDER_SETOR','pulmao.finalizar_contagem'),('LIDER_SETOR','abastecimento.receber'),
  ('LIDER_SETOR','parametro.sugerir'),

  ('SUBCHEFE','estoque.ver'),('SUBCHEFE','pulmao.contar'),
  ('SUBCHEFE','pulmao.finalizar_contagem'),('SUBCHEFE','abastecimento.receber'),
  ('SUBCHEFE','parametro.sugerir'),

  ('AUXILIAR','estoque.ver'),('AUXILIAR','pulmao.contar'),

  ('ESTAGIARIO_NUTRICAO','estoque.ver')
) as m(f,p)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Resolução de autoridade
-- ---------------------------------------------------------------------------

/** Função de maior precedência que a pessoa exerce AGORA nesta unidade. */
create or replace function public.estoque_funcao_exercida(p_unidade_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select pf.funcao_codigo
  from public.estoque_pessoa_funcoes pf
  join public.estoque_funcoes f on f.codigo = pf.funcao_codigo
  where pf.pessoa_id = auth.uid()
    and pf.unidade_id = p_unidade_id
    and pf.inicio <= now()
    and (pf.fim is null or pf.fim > now())
  order by f.precedencia desc
  limit 1
$$;

/** A pessoa tem a permissão nesta unidade, por função vigente ou concessão direta? */
create or replace function public.estoque_pode(p_unidade_id uuid, p_permissao text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.estoque_pessoa_funcoes pf
    join public.estoque_funcao_permissoes fp on fp.funcao_codigo = pf.funcao_codigo
    where pf.pessoa_id = auth.uid()
      and pf.unidade_id = p_unidade_id
      and fp.permissao_codigo = p_permissao
      and pf.inicio <= now()
      and (pf.fim is null or pf.fim > now())
  )
  or exists (
    select 1
    from public.estoque_pessoa_permissoes pp
    where pp.pessoa_id = auth.uid()
      and pp.unidade_id = p_unidade_id
      and pp.permissao_codigo = p_permissao
      and pp.inicio <= now()
      and (pp.fim is null or pp.fim > now())
  )
$$;

/** Setores aos quais a pessoa está vinculada por função vigente. */
create or replace function public.estoque_setores_da_pessoa(p_unidade_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select distinct pf.setor_id
  from public.estoque_pessoa_funcoes pf
  where pf.pessoa_id = auth.uid()
    and pf.unidade_id = p_unidade_id
    and pf.setor_id is not null
    and pf.inicio <= now()
    and (pf.fim is null or pf.fim > now())
$$;

/** Pode agir sobre este setor? Vínculo direto ou permissão ampla. */
create or replace function public.estoque_pode_no_setor(
  p_unidade_id uuid, p_setor_id uuid, p_permissao text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.estoque_pode(p_unidade_id, p_permissao)
     and (
       public.estoque_pode(p_unidade_id, 'pulmao.contar_qualquer')
       or p_setor_id in (select public.estoque_setores_da_pessoa(p_unidade_id))
     )
$$;

/** Herdado do módulo do Nazo: qual unidade a pessoa está operando. */
create or replace function public.estoque_pode_ver(p_unidade_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (
        coalesce(p.acesso_todas_unidades, false)
        or coalesce(p.unidade_ativa, p.unidade_id) = p_unidade_id
      )
  )
$$;
