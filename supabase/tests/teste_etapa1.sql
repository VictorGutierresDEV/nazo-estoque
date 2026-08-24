-- Roda o ciclo completo da Etapa 1 e aborta no fim, para não sujar o razão.
-- O relatório sai na mensagem da exceção final.
do $$
declare
  v_rel   text := E'\n';
  v_uid   uuid;
  v_uni   uuid;
  v_setor uuid;
  v_item  uuid;
  v_principal uuid; v_transito uuid; v_pulmao uuid;
  v_cont  uuid; v_rod uuid; v_div uuid; v_res jsonb;
  v_p0 numeric; v_p1 numeric; v_t1 numeric; v_l1 numeric;
  v_n integer;
  v_ok integer := 0; v_fail integer := 0;
  v_lider uuid;

begin
  -- ---- contexto autenticado -------------------------------------------------
  select id into v_uid from auth.users where email = 'victorgutierres@cajupar.com';
  perform set_config('request.jwt.claims',
                     json_build_object('sub', v_uid::text)::text, true);

  select id into v_uni from public.unidades where nome = 'Nazo Asa Sul';
  select id into v_setor from public.estoque_setores
    where unidade_id = v_uni and codigo = 'SUSHI';
  v_principal := public.estoque_local(v_uni, 'PRINCIPAL');
  v_transito  := public.estoque_local(v_uni, 'TRANSITO', v_setor);
  v_pulmao    := public.estoque_local(v_uni, 'PULMAO', v_setor);

  -- Segunda pessoa. O fluxo exige conferencia entre quem separa e quem recebe,
  -- entao o teste monta um lider do setor -- e reconstroi a funcao dele aqui
  -- dentro, para nao depender de quem esta cadastrado na producao.
  select p.id into v_lider from public.profiles p
   where p.id <> v_uid and coalesce(p.ativo, true)
     and coalesce(p.unidade_ativa, p.unidade_id) = v_uni
   order by p.id limit 1;
  delete from public.estoque_pessoa_funcoes where pessoa_id = v_lider and unidade_id = v_uni;
  insert into public.estoque_pessoa_funcoes (pessoa_id, unidade_id, funcao_codigo, setor_id)
  values (v_lider, v_uni, 'LIDER_SETOR', v_setor);

  select id into v_item from public.estoque_itens
   where unidade_id = v_uni and ativo order by nome limit 1;

  -- Depois da reinicializacao o razao nasce vazio, entao o proprio teste cria
  -- o saldo de partida pelo inventario de implantacao -- e assim tambem
  -- exercita esse fluxo.
  perform public.estoque_lancar_inventario_implantacao(
    v_uni,
    jsonb_build_array(jsonb_build_object('item_id', v_item, 'quantidade', 570)),
    current_date, 'teste automatizado');

  v_p0 := public.estoque_saldo_em(v_principal, v_item);
  v_rel := v_rel || format('contexto: item com %s no principal%s', v_p0, E'\n');

  -- T1 permissao ------------------------------------------------------------
  if public.estoque_pode(v_uni, 'parametro.minimo_pulmao.definir')
     and public.estoque_funcao_exercida(v_uni) = 'DIRECAO' then
    v_ok := v_ok + 1; v_rel := v_rel || 'T1  ok    funcao DIRECAO resolvida e permissao concedida' || E'\n';
  else
    v_fail := v_fail + 1; v_rel := v_rel || 'T1  FALHA autoridade nao resolvida' || E'\n';
  end if;

  -- T2 minimo do pulmao + historico ----------------------------------------
  perform public.estoque_definir_minimo_pulmao(v_uni, v_setor, v_item, 20, 'teste');
  select count(*) into v_n from public.estoque_eventos
   where tipo = 'PARAMETRO_ALTERADO' and entidade_tipo = 'MINIMO_PULMAO';
  if v_n > 0 then v_ok := v_ok + 1;
    v_rel := v_rel || 'T2  ok    minimo definido e evento gravado' || E'\n';
  else v_fail := v_fail + 1; v_rel := v_rel || 'T2  FALHA sem evento de parametro' || E'\n'; end if;

  -- T3 contagem: auxiliar preenche, lider finaliza --------------------------
  v_cont := public.estoque_abrir_contagem(v_uni, v_setor, current_date);
  perform public.estoque_lancar_contagem_item(v_cont, v_item, 0);
  v_res := public.estoque_finalizar_contagem(v_cont, v_uid);
  if (v_res ->> 'saidas_nao_discriminadas')::int = 0
     and (v_res ->> 'divergencias_abertas')::int = 0 then
    v_ok := v_ok + 1; v_rel := v_rel || 'T3  ok    pulmao vazio contado 0: nenhum movimento, nenhuma divergencia' || E'\n';
  else v_fail := v_fail + 1; v_rel := v_rel || 'T3  FALHA ' || v_res::text || E'\n'; end if;

  -- T4 rodada: sugestao = minimo - contado ---------------------------------
  v_rod := public.estoque_gerar_rodada(v_cont);
  select qtd_sugerida into v_l1 from public.estoque_rodada_itens
   where rodada_id = v_rod and item_id = v_item;
  if v_l1 = 20 then v_ok := v_ok + 1;
    v_rel := v_rel || 'T4  ok    sugestao 20 (minimo 20 - contado 0)' || E'\n';
  else v_fail := v_fail + 1; v_rel := v_rel || format('T4  FALHA sugestao %s', v_l1) || E'\n'; end if;

  -- T5 ajuste guarda sugerido E separado -----------------------------------
  perform public.estoque_ajustar_separacao(v_rod, v_item, 15, 'operacao pediu menos');
  select qtd_sugerida, qtd_separada into v_l1, v_t1
    from public.estoque_rodada_itens where rodada_id = v_rod and item_id = v_item;
  if v_l1 = 20 and v_t1 = 15 then v_ok := v_ok + 1;
    v_rel := v_rel || 'T5  ok    sugerido 20 e separado 15 coexistem' || E'\n';
  else v_fail := v_fail + 1; v_rel := v_rel || 'T5  FALHA par sugerido/separado' || E'\n'; end if;

  -- T6 separacao: PRINCIPAL -> TRANSITO ------------------------------------
  perform public.estoque_confirmar_separacao(v_rod);
  v_p1 := public.estoque_saldo_em(v_principal, v_item);
  v_t1 := public.estoque_saldo_em(v_transito, v_item);
  if v_p1 = v_p0 - 15 and v_t1 = 15 then v_ok := v_ok + 1;
    v_rel := v_rel || 'T6  ok    principal -15, transito +15' || E'\n';
  else v_fail := v_fail + 1;
    v_rel := v_rel || format('T6  FALHA principal %s transito %s', v_p1, v_t1) || E'\n'; end if;

  -- T7 recebimento parcial: residuo fica em transito -----------------------
  -- Troca de pessoa: quem separou nao recebe (quebra de custodia).
  perform set_config('request.jwt.claims',
                     json_build_object('sub', v_lider::text)::text, true);
  v_res := public.estoque_confirmar_recebimento(
    v_rod, jsonb_build_array(jsonb_build_object('item_id', v_item, 'quantidade', 12)));
  v_t1 := public.estoque_saldo_em(v_transito, v_item);
  v_l1 := public.estoque_saldo_em(v_pulmao, v_item);
  if v_t1 = 3 and v_l1 = 12 and (v_res ->> 'divergencias_abertas')::int = 1 then
    v_ok := v_ok + 1;
    v_rel := v_rel || 'T7  ok    recebeu 12, pulmao 12, residuo 3 permanece em transito, 1 divergencia' || E'\n';
  else v_fail := v_fail + 1;
    v_rel := v_rel || format('T7  FALHA transito %s pulmao %s res %s', v_t1, v_l1, v_res::text) || E'\n'; end if;

  -- Volta ao Victor: apurar divergencia exige permissao que o lider nao tem.
  perform set_config('request.jwt.claims',
                     json_build_object('sub', v_uid::text)::text, true);

  -- T8 causa errada para a origem da divergencia ---------------------------
  select id into v_div from public.estoque_divergencias
   where rodada_id = v_rod and situacao = 'PENDENTE' limit 1;
  begin
    perform public.estoque_apurar_divergencia(v_div, 'ERRO_CONTAGEM', 'x');
    v_fail := v_fail + 1; v_rel := v_rel || 'T8  FALHA aceitou causa de contagem em residuo de transito' || E'\n';
  exception when others then
    v_ok := v_ok + 1; v_rel := v_rel || 'T8  ok    recusou causa incompativel com a origem' || E'\n';
  end;

  -- T9 perda em transito exige motivo --------------------------------------
  begin
    perform public.estoque_apurar_divergencia(v_div, 'PERDA_TRANSITO', '  ');
    v_fail := v_fail + 1; v_rel := v_rel || 'T9  FALHA aceitou perda sem motivo' || E'\n';
  exception when others then
    v_ok := v_ok + 1; v_rel := v_rel || 'T9  ok    perda em transito exigiu motivo' || E'\n';
  end;

  -- T10 apuracao ERRO_SEPARACAO devolve ao principal (L12) ------------------
  perform public.estoque_apurar_divergencia(
    v_div, 'ERRO_SEPARACAO', 'conferido: so 12 sairam da sala');
  v_p1 := public.estoque_saldo_em(v_principal, v_item);
  v_t1 := public.estoque_saldo_em(v_transito, v_item);
  if v_t1 = 0 and v_p1 = v_p0 - 12 then v_ok := v_ok + 1;
    v_rel := v_rel || 'T10 ok    residuo 3 voltou ao principal, transito zerado' || E'\n';
  else v_fail := v_fail + 1;
    v_rel := v_rel || format('T10 FALHA principal %s transito %s', v_p1, v_t1) || E'\n'; end if;

  -- T11 P1: movimento fora de fluxo nomeado --------------------------------
  begin
    insert into public.estoque_movimentos
      (unidade_id, item_id, local_origem_id, local_destino_id, quantidade,
       fluxo, documento_tipo, registrado_por)
    values (v_uni, v_item, v_principal, v_pulmao, 1,
            'ABASTECIMENTO_SEPARACAO', 'TESTE', v_uid);
    v_fail := v_fail + 1; v_rel := v_rel || 'T11 FALHA aceitou PRINCIPAL->PULMAO direto' || E'\n';
  exception when others then
    v_ok := v_ok + 1; v_rel := v_rel || 'T11 ok    recusou transferencia fora do fluxo nomeado' || E'\n';
  end;

  -- T12 contado MAIOR que esperado: divergencia, sem entrada automatica (L11)
  v_cont := public.estoque_abrir_contagem(v_uni, v_setor, current_date + 1);
  perform public.estoque_lancar_contagem_item(v_cont, v_item, 18);  -- esperado 12
  v_res := public.estoque_finalizar_contagem(v_cont, v_uid);
  v_l1 := public.estoque_saldo_em(v_pulmao, v_item);
  if (v_res ->> 'divergencias_abertas')::int = 1
     and (v_res ->> 'saidas_nao_discriminadas')::int = 0
     and v_l1 = 12 then
    v_ok := v_ok + 1;
    v_rel := v_rel || 'T12 ok    contado 18 > esperado 12: divergencia aberta, pulmao segue 12 (sem entrada automatica)' || E'\n';
  else v_fail := v_fail + 1;
    v_rel := v_rel || format('T12 FALHA %s pulmao %s', v_res::text, v_l1) || E'\n'; end if;

  -- T13 contado MENOR: saida operacional nao discriminada -------------------
  v_cont := public.estoque_abrir_contagem(v_uni, v_setor, current_date + 2);
  perform public.estoque_lancar_contagem_item(v_cont, v_item, 4);   -- esperado 12
  v_res := public.estoque_finalizar_contagem(v_cont, v_uid);
  v_l1 := public.estoque_saldo_em(v_pulmao, v_item);
  select count(*) into v_n from public.estoque_movimentos
   where fluxo = 'FECHAMENTO_PULMAO_SOND' and item_id = v_item;
  if v_l1 = 4 and v_n = 1 and (v_res ->> 'divergencias_abertas')::int = 0 then
    v_ok := v_ok + 1;
    v_rel := v_rel || 'T13 ok    esperado 12 contado 4: saida nao discriminada de 8, pulmao vai a 4, sem divergencia' || E'\n';
  else v_fail := v_fail + 1;
    v_rel := v_rel || format('T13 FALHA pulmao %s sond %s %s', v_l1, v_n, v_res::text) || E'\n'; end if;

  -- T14 nao finaliza contagem omitindo item com saldo -----------------------
  v_cont := public.estoque_abrir_contagem(v_uni, v_setor, current_date + 3);
  begin
    perform public.estoque_finalizar_contagem(v_cont, v_uid);
    v_fail := v_fail + 1; v_rel := v_rel || 'T14 FALHA finalizou omitindo item com saldo' || E'\n';
  exception when others then
    v_ok := v_ok + 1; v_rel := v_rel || 'T14 ok    recusou finalizar com item de saldo nao contado' || E'\n';
  end;

  -- T15 razao e imutavel ---------------------------------------------------
  begin
    update public.estoque_movimentos set quantidade = 1
     where fluxo = 'FECHAMENTO_PULMAO_SOND' and item_id = v_item;
    v_fail := v_fail + 1; v_rel := v_rel || 'T15 FALHA razao aceitou UPDATE' || E'\n';
  exception when others then
    v_ok := v_ok + 1; v_rel := v_rel || 'T15 ok    razao recusou UPDATE' || E'\n';
  end;

  -- T16 saldo inicial nao se repete ----------------------------------------
  begin
    perform public.estoque_lancar_inventario_implantacao(
      v_uni, jsonb_build_array(jsonb_build_object('item_id', v_item, 'quantidade', 5)));
    v_fail := v_fail + 1; v_rel := v_rel || 'T16 FALHA aceitou segundo saldo inicial' || E'\n';
  exception when others then
    v_ok := v_ok + 1; v_rel := v_rel || 'T16 ok    recusou saldo inicial duplicado' || E'\n';
  end;

  raise exception E'%\n=== % ok, % falha(s) === (transacao desfeita)',
    v_rel, v_ok, v_fail;
end $$;
