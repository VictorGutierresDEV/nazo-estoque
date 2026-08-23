-- ============================================================================
-- ETAPA 1 · Parte 6/6 — Migração dos dados reais, RLS e bootstrap
-- ============================================================================
-- Preserva o que já existe: 87 itens importados e o saldo inicial de 71 linhas
-- lançado em 23/ago. O modelo antigo NÃO é derrubado aqui — sai numa migration
-- própria, junto com o deploy do app novo, para o que está no ar não quebrar.
-- ============================================================================

-- Permissão de cadastro, que faltava no catálogo.
insert into public.estoque_permissoes (codigo, descricao) values
  ('cadastro.gerenciar', 'Cadastrar e editar setores, locais e itens')
on conflict (codigo) do nothing;

insert into public.estoque_funcao_permissoes (funcao_codigo, permissao_codigo)
values ('DIRECAO','cadastro.gerenciar'),
       ('GERENTE_CPD','cadastro.gerenciar'),
       ('ESTOQUISTA','cadastro.gerenciar')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 1. Setores — os 6 do §3.2, nas duas unidades
-- ---------------------------------------------------------------------------
insert into public.estoque_setores (unidade_id, nome, codigo, ordem)
select u.id, s.nome, s.codigo, s.ordem
from public.unidades u,
     (values ('Sushi','SUSHI',1), ('Cozinha','COZINHA',2), ('Bar','BAR',3),
             ('Delivery','DELIVERY',4), ('Limpeza','LIMPEZA',5), ('Salão','SALAO',6)
     ) as s(nome, codigo, ordem)
where u.ativo
on conflict (unidade_id, codigo) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Locais — as camadas
-- ---------------------------------------------------------------------------
insert into public.estoque_locais (unidade_id, setor_id, tipo, nome)
select u.id, null, 'PRINCIPAL', 'Estoque Principal'
from public.unidades u where u.ativo
on conflict do nothing;

insert into public.estoque_locais (unidade_id, setor_id, tipo, nome)
select s.unidade_id, s.id, t.tipo, t.rotulo || ' — ' || s.nome
from public.estoque_setores s,
     (values ('TRANSITO','Trânsito'), ('PULMAO','Pulmão'), ('PRACA','Praça')
     ) as t(tipo, rotulo)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 3. Itens — migra os 87 produtos preservando os ids
-- ---------------------------------------------------------------------------
insert into public.estoque_itens
  (id, unidade_id, nome, categoria, unidade_contagem, ean, custo_medio, ativo, criado_em)
select p.id, p.unidade_id, p.nome, p.categoria, p.unidade_medida,
       p.ean, p.custo_medio, p.ativo, p.created_at
from public.estoque_produtos p
on conflict (id) do nothing;

-- §12.3 nomeia o camarão 51/60 como item crítico conhecido.
update public.estoque_itens
set critico = true
where nome ilike '%camarao%51/60%' or nome ilike '%camarão%51/60%';

-- ---------------------------------------------------------------------------
-- 4. Mínimo da CASA — o mínimo importado é por item, sem setor, então só pode
--    ser o global. O mínimo do pulmão é por setor+item e será preenchido na
--    operação.
-- ---------------------------------------------------------------------------
insert into public.estoque_minimo_casa (unidade_id, item_id, quantidade)
select p.unidade_id, p.id, p.estoque_minimo
from public.estoque_produtos p
where coalesce(p.estoque_minimo, 0) > 0
on conflict (unidade_id, item_id) do nothing;

-- ---------------------------------------------------------------------------
-- 5. Saldo inicial — a entrada de 23/ago era, na prática, um inventário de
--    implantação. Passa a ser registrada como tal.
-- ---------------------------------------------------------------------------
do $$
declare
  v_t         record;
  v_inv       uuid;
  v_principal uuid;
begin
  for v_t in
    select t.id, t.unidade_id, t.ocorrido_em, t.registrado_por, t.observacao
    from public.estoque_transacoes t
    where t.tipo = 'ENTRADA' and t.fornecedor = 'Saldo inicial'
  loop
    v_principal := public.estoque_local(v_t.unidade_id, 'PRINCIPAL');

    -- Idempotente: se já migrou, não repete.
    if exists (
      select 1 from public.estoque_movimentos
      where documento_tipo = 'INVENTARIO' and fluxo = 'SALDO_INICIAL'
        and unidade_id = v_t.unidade_id
    ) then
      continue;
    end if;

    insert into public.estoque_inventarios
      (unidade_id, data_referencia, responsavel, observacao)
    values
      (v_t.unidade_id, v_t.ocorrido_em::date, v_t.registrado_por,
       'Migrado da importação de planilha de 23/ago/2026')
    returning id into v_inv;

    insert into public.estoque_inventario_itens (inventario_id, local_id, item_id, quantidade)
    select v_inv, v_principal, l.produto_id, sum(l.delta)
    from public.estoque_lancamentos l
    where l.transacao_id = v_t.id and l.delta > 0
    group by l.produto_id
    having sum(l.delta) > 0;

    insert into public.estoque_movimentos
      (unidade_id, item_id, local_origem_id, local_destino_id, quantidade,
       fluxo, documento_tipo, documento_id, momento, registrado_por)
    select v_t.unidade_id, ii.item_id, null, v_principal, ii.quantidade,
           'SALDO_INICIAL', 'INVENTARIO', v_inv, v_t.ocorrido_em, v_t.registrado_por
    from public.estoque_inventario_itens ii
    where ii.inventario_id = v_inv;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Bootstrap de autoridade
-- ---------------------------------------------------------------------------
-- Mapa INICIAL, ajustável na operação sem deploy. O papel do app do Nazo é o
-- ponto de partida; a função operacional definitiva é decisão do Victor.
insert into public.estoque_pessoa_funcoes (pessoa_id, unidade_id, funcao_codigo, setor_id)
select
  p.id,
  coalesce(p.unidade_ativa, p.unidade_id),
  case p.role
    when 'owner'     then 'DIRECAO'
    when 'manager'   then 'GERENTE_BACK'
    when 'leader'    then 'LIDER_SETOR'
    when 'subleader' then 'SUBCHEFE'
    when 'nutri'     then 'ESTAGIARIO_NUTRICAO'
  end,
  -- Vincula ao setor pelo cadastro de RH, quando o nome casar com um setor.
  (select s.id from public.estoque_setores s
   join public.colaboradores c on c.profile_id = p.id
   where s.unidade_id = coalesce(p.unidade_ativa, p.unidade_id)
     and lower(translate(s.nome, 'ãáâàéêíóôõúüç', 'aaaaeeiooouuc'))
       = lower(translate(coalesce(c.setor,''), 'ãáâàéêíóôõúüç', 'aaaaeeiooouuc'))
   limit 1)
from public.profiles p
where coalesce(p.ativo, true)
  and p.role in ('owner','manager','leader','subleader','nutri')
  and coalesce(p.unidade_ativa, p.unidade_id) is not null
  and not exists (
    select 1 from public.estoque_pessoa_funcoes pf
    where pf.pessoa_id = p.id
      and pf.unidade_id = coalesce(p.unidade_ativa, p.unidade_id)
  );

-- ---------------------------------------------------------------------------
-- 7. RLS — leitura escopada; escrita só pelas funções SECURITY DEFINER
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'estoque_setores','estoque_locais','estoque_itens',
    'estoque_movimentos','estoque_eventos',
    'estoque_minimo_pulmao','estoque_minimo_casa','estoque_parametro_sugestoes',
    'estoque_contagens','estoque_contagem_itens',
    'estoque_rodadas','estoque_rodada_itens',
    'estoque_divergencias','estoque_inventarios','estoque_inventario_itens',
    'estoque_unidade_config','estoque_pessoa_funcoes','estoque_pessoa_permissoes'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_leitura', t);
  end loop;
end $$;

-- Tabelas com unidade_id própria
create policy estoque_setores_leitura on public.estoque_setores
  for select to authenticated using (public.estoque_pode_ver(unidade_id));
create policy estoque_locais_leitura on public.estoque_locais
  for select to authenticated using (public.estoque_pode_ver(unidade_id));
create policy estoque_itens_leitura on public.estoque_itens
  for select to authenticated using (public.estoque_pode_ver(unidade_id));
create policy estoque_movimentos_leitura on public.estoque_movimentos
  for select to authenticated using (public.estoque_pode_ver(unidade_id));
create policy estoque_eventos_leitura on public.estoque_eventos
  for select to authenticated using (public.estoque_pode_ver(unidade_id));
create policy estoque_minimo_pulmao_leitura on public.estoque_minimo_pulmao
  for select to authenticated using (public.estoque_pode_ver(unidade_id));
create policy estoque_minimo_casa_leitura on public.estoque_minimo_casa
  for select to authenticated using (public.estoque_pode_ver(unidade_id));
create policy estoque_sugestoes_leitura on public.estoque_parametro_sugestoes
  for select to authenticated using (public.estoque_pode_ver(unidade_id));
create policy estoque_contagens_leitura on public.estoque_contagens
  for select to authenticated using (public.estoque_pode_ver(unidade_id));
create policy estoque_rodadas_leitura on public.estoque_rodadas
  for select to authenticated using (public.estoque_pode_ver(unidade_id));
create policy estoque_divergencias_leitura on public.estoque_divergencias
  for select to authenticated using (public.estoque_pode_ver(unidade_id));
create policy estoque_inventarios_leitura on public.estoque_inventarios
  for select to authenticated using (public.estoque_pode_ver(unidade_id));
create policy estoque_config_leitura on public.estoque_unidade_config
  for select to authenticated using (public.estoque_pode_ver(unidade_id));
create policy estoque_pessoa_funcoes_leitura on public.estoque_pessoa_funcoes
  for select to authenticated using (public.estoque_pode_ver(unidade_id));
create policy estoque_pessoa_permissoes_leitura on public.estoque_pessoa_permissoes
  for select to authenticated using (public.estoque_pode_ver(unidade_id));

-- Filhas: escopo herdado do pai
create policy estoque_contagem_itens_leitura on public.estoque_contagem_itens
  for select to authenticated using (exists (
    select 1 from public.estoque_contagens c
    where c.id = contagem_id and public.estoque_pode_ver(c.unidade_id)));
create policy estoque_rodada_itens_leitura on public.estoque_rodada_itens
  for select to authenticated using (exists (
    select 1 from public.estoque_rodadas r
    where r.id = rodada_id and public.estoque_pode_ver(r.unidade_id)));
create policy estoque_inventario_itens_leitura on public.estoque_inventario_itens
  for select to authenticated using (exists (
    select 1 from public.estoque_inventarios i
    where i.id = inventario_id and public.estoque_pode_ver(i.unidade_id)));

-- Cadastro é o único CRUD direto, e mesmo assim gated por permissão.
create policy estoque_setores_gestao on public.estoque_setores
  for all to authenticated
  using (public.estoque_pode(unidade_id, 'cadastro.gerenciar'))
  with check (public.estoque_pode(unidade_id, 'cadastro.gerenciar'));
create policy estoque_itens_gestao on public.estoque_itens
  for all to authenticated
  using (public.estoque_pode(unidade_id, 'cadastro.gerenciar'))
  with check (public.estoque_pode(unidade_id, 'cadastro.gerenciar'));

-- Catálogos são leitura para todos os autenticados.
alter table public.estoque_funcoes enable row level security;
alter table public.estoque_permissoes enable row level security;
alter table public.estoque_funcao_permissoes enable row level security;
alter table public.estoque_fluxos enable row level security;
alter table public.estoque_causas_divergencia enable row level security;

create policy estoque_funcoes_leitura on public.estoque_funcoes
  for select to authenticated using (true);
create policy estoque_permissoes_leitura on public.estoque_permissoes
  for select to authenticated using (true);
create policy estoque_funcao_permissoes_leitura on public.estoque_funcao_permissoes
  for select to authenticated using (true);
create policy estoque_fluxos_leitura on public.estoque_fluxos
  for select to authenticated using (true);
create policy estoque_causas_leitura on public.estoque_causas_divergencia
  for select to authenticated using (true);

grant select on public.estoque_saldos_locais to authenticated;
