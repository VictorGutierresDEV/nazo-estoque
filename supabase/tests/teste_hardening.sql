-- ============================================================================
-- Testes da rodada de blindagem da Etapa 1
-- ============================================================================
-- Roda tudo numa transação e aborta no fim: o razão não é sujo.
--
-- DUAS ARMADILHAS QUE ESTE ARQUIVO EVITA DE PROPÓSITO:
--
-- 1. `set local role authenticated`. Sem isso o script roda como dono da
--    tabela, para quem a RLS NÃO se aplica, e os testes de RLS passariam por
--    engano — um insert direto seria aceito aqui e recusado para o cliente.
--
-- 2. O teste MONTA suas próprias fixtures de autoridade. A primeira versão
--    escolhia um profile arbitrário da produção como "líder" e acabou pegando
--    uma pessoa com papel owner, que legitimamente tem cadastro.gerenciar —
--    o teste acusou furo de RLS onde não havia. Aqui as funções da pessoa de
--    teste são apagadas e recriadas dentro da transação, então o resultado não
--    depende de quem está cadastrado hoje.
-- ============================================================================
do $$
declare
  v_rel text := E'\n';
  v_ok  integer := 0;
  v_fail integer := 0;

  v_victor uuid; v_lider uuid; v_outro uuid;
  v_uni uuid; v_bh uuid;
  v_sushi uuid; v_bar uuid;
  v_principal uuid; v_transito uuid; v_pulmao uuid; v_bh_principal uuid;
  v_item uuid; v_item2 uuid; v_item_bh uuid; v_mov uuid;
  v_cont uuid; v_rod uuid;
  v_n integer; v_q numeric; v_res jsonb; v_txt text;
begin
  -- =====================================================================
  -- Fixtures (papel privilegiado)
  -- =====================================================================
  select id into v_victor from auth.users where email = 'victorgutierres@cajupar.com';
  select id into v_uni from public.unidades where nome = 'Nazo Asa Sul';
  select id into v_bh  from public.unidades where nome = 'Nazo Belo Horizonte';

  select id into v_sushi from public.estoque_setores where unidade_id = v_uni and codigo = 'SUSHI';
  select id into v_bar   from public.estoque_setores where unidade_id = v_uni and codigo = 'BAR';

  v_principal    := public.estoque_local(v_uni, 'PRINCIPAL');
  v_transito     := public.estoque_local(v_uni, 'TRANSITO', v_sushi);
  v_pulmao       := public.estoque_local(v_uni, 'PULMAO', v_sushi);
  v_bh_principal := public.estoque_local(v_bh, 'PRINCIPAL');

  select id into v_item from public.estoque_itens
   where unidade_id = v_uni and ativo order by nome limit 1;
  select id into v_item2 from public.estoque_itens
   where unidade_id = v_uni and ativo and id <> v_item order by nome limit 1;

  -- Duas pessoas de teste, escolhidas de forma determinística e com a
  -- autoridade RECONSTRUÍDA aqui dentro.
  select p.id into v_lider from public.profiles p
   where p.id <> v_victor and coalesce(p.ativo, true)
     and coalesce(p.acesso_todas_unidades, false) = false
     and coalesce(p.unidade_ativa, p.unidade_id) = v_uni
   order by p.id limit 1;

  select p.id into v_outro from public.profiles p
   where p.id not in (v_victor, v_lider) and coalesce(p.ativo, true)
   order by p.id limit 1;

  if v_lider is null or v_outro is null then
    raise exception 'Fixtures insuficientes: preciso de dois profiles alem do Victor.';
  end if;

  -- v_lider: SOMENTE líder do Sushi. Sem cadastro.gerenciar, sem acesso amplo.
  delete from public.estoque_pessoa_funcoes where pessoa_id = v_lider and unidade_id = v_uni;
  delete from public.estoque_pessoa_permissoes where pessoa_id = v_lider and unidade_id = v_uni;
  insert into public.estoque_pessoa_funcoes (pessoa_id, unidade_id, funcao_codigo, setor_id)
  values (v_lider, v_uni, 'LIDER_SETOR', v_sushi);

  -- v_outro: começa SEM função nenhuma nesta unidade.
  delete from public.estoque_pessoa_funcoes where pessoa_id = v_outro and unidade_id = v_uni;
  delete from public.estoque_pessoa_permissoes where pessoa_id = v_outro and unidade_id = v_uni;

  -- Dado de BH, para provar isolamento entre unidades.
  insert into public.estoque_itens (unidade_id, nome, unidade_contagem)
  values (v_bh, 'ITEM TESTE BH', 'un') returning id into v_item_bh;
  insert into public.estoque_movimentos
    (unidade_id, item_id, local_origem_id, local_destino_id, quantidade,
     fluxo, documento_tipo, registrado_por)
  values (v_bh, v_item_bh, null, v_bh_principal, 99, 'SALDO_INICIAL', 'TESTE', v_victor);

  perform set_config('request.jwt.claims',
                     json_build_object('sub', v_victor::text)::text, true);

  perform public.estoque_lancar_inventario_implantacao(
    v_uni, jsonb_build_array(jsonb_build_object('item_id', v_item, 'quantidade', 500)),
    current_date, 'teste de blindagem');

  select id into v_mov from public.estoque_movimentos
   where unidade_id = v_uni and item_id = v_item and fluxo = 'SALDO_INICIAL' limit 1;

  -- =====================================================================
  -- Item 2 — líder responsável validado no banco
  -- =====================================================================
  v_cont := public.estoque_abrir_contagem(v_uni, v_sushi, current_date);
  perform public.estoque_lancar_contagem_item(v_cont, v_item, 12);

  begin
    perform public.estoque_finalizar_contagem(v_cont, '11111111-1111-1111-1111-111111111111'::uuid);
    v_fail := v_fail + 1; v_rel := v_rel || 'H1  FALHA aceitou uuid inexistente como lider' || E'\n';
  exception when others then
    v_ok := v_ok + 1; v_rel := v_rel || 'H1  ok    recusou uuid inexistente como lider' || E'\n';
  end;

  begin
    perform public.estoque_finalizar_contagem(v_cont, v_outro);
    v_fail := v_fail + 1; v_rel := v_rel || 'H2  FALHA aceitou pessoa sem funcao vigente' || E'\n';
  exception when others then
    v_ok := v_ok + 1; v_rel := v_rel || 'H2  ok    recusou pessoa sem funcao vigente' || E'\n';
  end;

  -- Agora v_outro é subchefe do BAR. Nao pode responder pelo SUSHI.
  insert into public.estoque_pessoa_funcoes (pessoa_id, unidade_id, funcao_codigo, setor_id)
  values (v_outro, v_uni, 'SUBCHEFE', v_bar);

  begin
    perform public.estoque_finalizar_contagem(v_cont, v_outro);
    v_fail := v_fail + 1; v_rel := v_rel || 'H3  FALHA aceitou lider de outro setor' || E'\n';
  exception when others then
    v_ok := v_ok + 1;
    v_rel := v_rel || 'H3  ok    recusou subchefe do Bar respondendo pelo Sushi' || E'\n';
  end;

  -- =====================================================================
  -- Item 4 — rastro de edição da contagem
  -- =====================================================================
  perform public.estoque_lancar_contagem_item(v_cont, v_item, 10);
  select count(*) into v_n from public.estoque_eventos
   where tipo = 'CONTAGEM_ITEM_ALTERADO' and entidade_id = v_cont
     and (dados_anteriores ->> 'quantidade')::numeric = 12
     and (dados_novos ->> 'quantidade')::numeric = 10;
  if v_n = 1 then v_ok := v_ok + 1;
    v_rel := v_rel || 'H4  ok    edicao 12 -> 10 deixou rastro com anterior, novo, autor e funcao' || E'\n';
  else v_fail := v_fail + 1;
    v_rel := v_rel || format('H4  FALHA eventos de edicao: %s', v_n) || E'\n'; end if;

  v_res := public.estoque_finalizar_contagem(v_cont, v_lider);
  v_ok := v_ok + 1;
  v_rel := v_rel || 'H5  ok    finalizou com lider valido do proprio setor' || E'\n';

  -- =====================================================================
  -- Itens 3 e 5 — custódia e excesso no recebimento
  -- =====================================================================
  perform public.estoque_definir_minimo_pulmao(v_uni, v_sushi, v_item, 30, 'teste');
  v_cont := public.estoque_abrir_contagem(v_uni, v_sushi, current_date + 1);
  perform public.estoque_lancar_contagem_item(v_cont, v_item, 10);
  perform public.estoque_finalizar_contagem(v_cont, v_lider);
  v_rod := public.estoque_gerar_rodada(v_cont);
  perform public.estoque_ajustar_separacao(v_rod, v_item, 10, 'teste');
  perform public.estoque_confirmar_separacao(v_rod);

  begin
    perform public.estoque_confirmar_recebimento(
      v_rod, jsonb_build_array(jsonb_build_object('item_id', v_item, 'quantidade', 10)));
    v_fail := v_fail + 1;
    v_rel := v_rel || 'H6  FALHA quem separou confirmou o proprio recebimento' || E'\n';
  exception when others then
    v_ok := v_ok + 1;
    v_rel := v_rel || 'H6  ok    quebra de custodia: quem separou nao recebe' || E'\n';
  end;

  perform set_config('request.jwt.claims',
                     json_build_object('sub', v_lider::text)::text, true);

  begin
    perform public.estoque_confirmar_recebimento(
      v_rod, jsonb_build_array(jsonb_build_object('item_id', v_item, 'quantidade', 13)));
    v_fail := v_fail + 1;
    v_rel := v_rel || 'H7  FALHA aceitou receber 13 de 10 separados' || E'\n';
  exception when others then
    v_ok := v_ok + 1;
    v_rel := v_rel || 'H7  ok    recusou receber acima do separado, sem corrigir em silencio' || E'\n';
  end;

  v_res := public.estoque_confirmar_recebimento(
    v_rod, jsonb_build_array(jsonb_build_object('item_id', v_item, 'quantidade', 7)));
  if public.estoque_saldo_em(v_transito, v_item) = 3
     and public.estoque_saldo_em(v_pulmao, v_item) = 7
     and (v_res ->> 'divergencias_abertas')::int = 1 then
    v_ok := v_ok + 1;
    v_rel := v_rel || 'H8  ok    recebeu 7 de 10, pulmao 7, residuo 3 em transito com divergencia' || E'\n';
  else v_fail := v_fail + 1;
    v_rel := v_rel || 'H8  FALHA residuo incorreto' || E'\n'; end if;

  -- =====================================================================
  -- Item 7 — esperado congelado para a tela pós-finalização
  -- =====================================================================
  v_cont := public.estoque_abrir_contagem(v_uni, v_sushi, current_date + 2);
  perform public.estoque_lancar_contagem_item(v_cont, v_item, 5);
  v_res := public.estoque_finalizar_contagem(v_cont, v_lider);
  select quantidade_esperada into v_q from public.estoque_contagem_itens
   where contagem_id = v_cont and item_id = v_item;
  if v_q = 7 and (v_res ->> 'saidas_nao_discriminadas')::int = 1
     and public.estoque_saldo_em(v_pulmao, v_item) = 5 then
    v_ok := v_ok + 1;
    v_rel := v_rel || 'H9  ok    esperado 7 congelado, contado 5, saida nao discriminada de 2' || E'\n';
  else v_fail := v_fail + 1;
    v_rel := v_rel || format('H9  FALHA esperado=%s res=%s', v_q, v_res::text) || E'\n'; end if;

  -- =====================================================================
  -- Item 8 — virada para produção
  -- =====================================================================
  perform set_config('request.jwt.claims',
                     json_build_object('sub', v_victor::text)::text, true);

  begin
    perform public.estoque_marcar_em_producao(v_uni);
    v_fail := v_fail + 1; v_rel := v_rel || 'H10 FALHA virou producao sem concluir locais' || E'\n';
  exception when others then
    v_ok := v_ok + 1; v_rel := v_rel || 'H10 ok    recusou virada com inventario incompleto' || E'\n';
  end;

  perform public.estoque_concluir_inventario_local(v_uni, v_principal);

  -- Local concluido esta fechado: nem item novo entra mais nele.
  begin
    perform public.estoque_lancar_inventario_implantacao(
      v_uni, jsonb_build_array(jsonb_build_object('item_id', v_item2, 'quantidade', 4)));
    v_fail := v_fail + 1;
    v_rel := v_rel || 'H10b FALHA lancou item em local ja concluido' || E'
';
  exception when others then
    v_ok := v_ok + 1;
    v_rel := v_rel || 'H10b ok   local concluido nao aceita mais lancamento' || E'
';
  end;

  begin
    perform public.estoque_marcar_em_producao(v_uni);
    v_fail := v_fail + 1; v_rel := v_rel || 'H11 FALHA virou producao faltando pulmoes' || E'\n';
  exception when others then
    v_ok := v_ok + 1; v_rel := v_rel || 'H11 ok    recusou virada faltando pulmao' || E'\n';
  end;

  begin
    perform public.estoque_concluir_inventario_local(v_uni, v_principal);
    v_fail := v_fail + 1; v_rel := v_rel || 'H12 FALHA concluiu o mesmo local duas vezes' || E'\n';
  exception when others then
    v_ok := v_ok + 1; v_rel := v_rel || 'H12 ok    recusou concluir o mesmo local duas vezes' || E'\n';
  end;

  begin
    perform public.estoque_concluir_inventario_local(
      v_uni, public.estoque_local(v_uni, 'PRACA', v_sushi));
    v_fail := v_fail + 1; v_rel := v_rel || 'H13 FALHA aceitou concluir inventario de PRACA' || E'\n';
  exception when others then
    v_ok := v_ok + 1;
    v_rel := v_rel || 'H13 ok    recusou concluir local que nao e principal nem pulmao' || E'\n';
  end;

  -- Um pulmão com TODOS os itens em zero pode ser concluído: é o caso que o
  -- Victor apontou — existência de movimento não pode ser o critério.
  select count(*) into v_n from public.estoque_locais l
   where l.unidade_id = v_uni and l.tipo = 'PULMAO' and l.ativo;
  for v_txt in
    select l.id::text from public.estoque_locais l
    where l.unidade_id = v_uni and l.tipo = 'PULMAO' and l.ativo
  loop
    perform public.estoque_concluir_inventario_local(v_uni, v_txt::uuid);
  end loop;

  select count(*) into v_n from public.estoque_inventario_locais where unidade_id = v_uni;
  if v_n = 7 then v_ok := v_ok + 1;
    v_rel := v_rel || 'H14 ok    7 locais concluidos (principal + 6 pulmoes), inclusive pulmao vazio' || E'\n';
  else v_fail := v_fail + 1;
    v_rel := v_rel || format('H14 FALHA locais concluidos: %s', v_n) || E'\n'; end if;

  perform public.estoque_marcar_em_producao(v_uni);

  begin
    perform public.estoque_lancar_inventario_implantacao(
      v_uni, jsonb_build_array(jsonb_build_object('item_id', v_item, 'quantidade', 5)));
    v_fail := v_fail + 1; v_rel := v_rel || 'H15 FALHA aceitou saldo inicial depois da virada' || E'\n';
  exception when others then
    v_ok := v_ok + 1;
    v_rel := v_rel || 'H15 ok    virada feita e saldo inicial bloqueado em definitivo' || E'\n';
  end;

  begin
    perform public.estoque_concluir_inventario_local(v_uni, v_principal);
    v_fail := v_fail + 1; v_rel := v_rel || 'H16 FALHA concluiu local depois da virada' || E'\n';
  exception when others then
    v_ok := v_ok + 1; v_rel := v_rel || 'H16 ok    conclusao de local bloqueada depois da virada' || E'\n';
  end;

  -- =====================================================================
  -- Item 1 — RLS de verdade, como papel `authenticated`
  -- v_lider e SOMENTE LIDER_SETOR do Sushi: sem cadastro.gerenciar e sem
  -- acesso a outras unidades.
  -- =====================================================================
  perform set_config('request.jwt.claims',
                     json_build_object('sub', v_lider::text)::text, true);
  execute 'set local role authenticated';

  begin
    insert into public.estoque_movimentos
      (unidade_id, item_id, local_origem_id, local_destino_id, quantidade,
       fluxo, documento_tipo, registrado_por)
    values (v_uni, v_item, v_principal, v_transito, 1,
            'ABASTECIMENTO_SEPARACAO', 'ATAQUE', v_lider);
    v_fail := v_fail + 1; v_rel := v_rel || 'H17 FALHA cliente inseriu no razao' || E'\n';
  exception when others then
    v_ok := v_ok + 1; v_rel := v_rel || 'H17 ok    RLS recusou insert direto no razao' || E'\n';
  end;

  update public.estoque_movimentos set quantidade = 1 where id = v_mov;
  get diagnostics v_n = row_count;
  select quantidade into v_q from public.estoque_movimentos where id = v_mov;
  if v_n = 0 and v_q = 500 then v_ok := v_ok + 1;
    v_rel := v_rel || 'H18 ok    RLS recusou update no razao (0 linhas, valor intacto)' || E'\n';
  else v_fail := v_fail + 1;
    v_rel := v_rel || format('H18 FALHA update afetou %s linha(s), qtd=%s', v_n, v_q) || E'\n'; end if;

  delete from public.estoque_movimentos where id = v_mov;
  get diagnostics v_n = row_count;
  if v_n = 0 then v_ok := v_ok + 1;
    v_rel := v_rel || 'H19 ok    RLS recusou delete no razao' || E'\n';
  else v_fail := v_fail + 1; v_rel := v_rel || 'H19 FALHA delete no razao passou' || E'\n'; end if;

  delete from public.estoque_eventos where unidade_id = v_uni;
  get diagnostics v_n = row_count;
  if v_n = 0 then v_ok := v_ok + 1;
    v_rel := v_rel || 'H20 ok    RLS recusou delete na trilha de auditoria' || E'\n';
  else v_fail := v_fail + 1; v_rel := v_rel || 'H20 FALHA delete na trilha passou' || E'\n'; end if;

  select count(*) into v_n from public.estoque_movimentos where unidade_id = v_bh;
  if v_n = 0 then v_ok := v_ok + 1;
    v_rel := v_rel || 'H21 ok    razao de outra unidade invisivel' || E'\n';
  else v_fail := v_fail + 1;
    v_rel := v_rel || format('H21 FALHA vazaram %s movimento(s) de outra unidade', v_n) || E'\n'; end if;

  select count(*) into v_n from public.estoque_itens where unidade_id = v_bh;
  if v_n = 0 then v_ok := v_ok + 1;
    v_rel := v_rel || 'H22 ok    itens de outra unidade invisiveis' || E'\n';
  else v_fail := v_fail + 1;
    v_rel := v_rel || format('H22 FALHA vazaram %s item(ns) de outra unidade', v_n) || E'\n'; end if;

  begin
    insert into public.estoque_itens (unidade_id, nome, unidade_contagem)
    values (v_uni, 'ITEM SEM AUTORIZACAO', 'un');
    v_fail := v_fail + 1; v_rel := v_rel || 'H23 FALHA lider cadastrou item sem permissao' || E'\n';
  exception when others then
    v_ok := v_ok + 1; v_rel := v_rel || 'H23 ok    RLS recusou cadastro de item sem permissao' || E'\n';
  end;

  begin
    insert into public.estoque_contagens (unidade_id, setor_id, ciclo, aberta_por)
    values (v_uni, v_sushi, current_date + 90, v_lider);
    v_fail := v_fail + 1; v_rel := v_rel || 'H24 FALHA criou contagem direto na tabela' || E'\n';
  exception when others then
    v_ok := v_ok + 1; v_rel := v_rel || 'H24 ok    RLS recusou criar contagem fora da RPC' || E'\n';
  end;

  update public.estoque_minimo_pulmao set quantidade = 9999
   where unidade_id = v_uni and setor_id = v_sushi;
  get diagnostics v_n = row_count;
  if v_n = 0 then v_ok := v_ok + 1;
    v_rel := v_rel || 'H25 ok    RLS recusou alterar minimo direto na tabela' || E'\n';
  else v_fail := v_fail + 1;
    v_rel := v_rel || 'H25 FALHA minimo alterado sem passar pela governanca' || E'\n'; end if;

  begin
    insert into public.estoque_fluxos (codigo, nome, origem_tipo, destino_tipo)
    values ('FLUXO_PIRATA', 'invencao', 'PULMAO', 'PRINCIPAL');
    v_fail := v_fail + 1; v_rel := v_rel || 'H26 FALHA cliente criou fluxo novo' || E'\n';
  exception when others then
    v_ok := v_ok + 1; v_rel := v_rel || 'H26 ok    recusou criar fluxo novo pelo cliente' || E'\n';
  end;

  begin
    delete from public.estoque_itens where unidade_id = v_uni and id = v_item;
    get diagnostics v_n = row_count;
    if v_n = 0 then v_ok := v_ok + 1;
      v_rel := v_rel || 'H27 ok    RLS recusou apagar item (sem policy de DELETE)' || E'\n';
    else v_fail := v_fail + 1; v_rel := v_rel || 'H27 FALHA item apagado' || E'\n'; end if;
  exception when others then
    v_ok := v_ok + 1; v_rel := v_rel || 'H27 ok    apagar item recusado' || E'\n';
  end;

  execute 'reset role';

  raise exception E'%\n=== % ok, % falha(s) === (transacao desfeita)', v_rel, v_ok, v_fail;
end $$;
