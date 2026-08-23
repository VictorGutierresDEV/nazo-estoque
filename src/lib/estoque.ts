import { criarClienteServidor } from '@/lib/supabase/server'

/**
 * Leitura da Etapa 1.
 *
 * Nada aqui calcula saldo: saldo vem sempre da view estoque_saldos_locais,
 * que soma o razão. Se um número desta tela não bater com o extrato, o bug
 * está no razão, não aqui — e é isso que se quer.
 */

export type Contexto = {
  usuarioId: string
  nome: string
  unidadeId: string
  unidadeNome: string
  funcao: string | null
  permissoes: Set<string>
  emProducao: boolean
  setoresVinculados: string[]
}

export async function carregarContexto(): Promise<Contexto | null> {
  const supabase = await criarClienteServidor()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: perfil } = await supabase
    .from('profiles')
    .select('id, nome, role, unidade_id, unidade_ativa, ativo')
    .eq('id', user.id)
    .single()
  if (!perfil) return null

  const unidadeId = perfil.unidade_ativa ?? perfil.unidade_id
  if (!unidadeId) return null

  const agora = new Date().toISOString()

  const [unidade, funcoes, diretas, config] = await Promise.all([
    supabase.from('unidades').select('nome').eq('id', unidadeId).single(),
    supabase
      .from('estoque_pessoa_funcoes')
      .select('funcao_codigo, setor_id, inicio, fim')
      .eq('pessoa_id', user.id)
      .eq('unidade_id', unidadeId),
    supabase
      .from('estoque_pessoa_permissoes')
      .select('permissao_codigo, inicio, fim')
      .eq('pessoa_id', user.id)
      .eq('unidade_id', unidadeId),
    supabase
      .from('estoque_unidade_config')
      .select('em_producao')
      .eq('unidade_id', unidadeId)
      .maybeSingle(),
  ])

  const vigente = <T extends { inicio: string; fim: string | null }>(r: T) =>
    r.inicio <= agora && (r.fim === null || r.fim > agora)

  const funcoesVigentes = (funcoes.data ?? []).filter(vigente)
  const codigos = funcoesVigentes.map((f) => f.funcao_codigo)

  const permissoes = new Set<string>(
    (diretas.data ?? []).filter(vigente).map((p) => p.permissao_codigo),
  )

  let funcao: string | null = null

  if (codigos.length) {
    const [porFuncao, precedencia] = await Promise.all([
      supabase
        .from('estoque_funcao_permissoes')
        .select('permissao_codigo')
        .in('funcao_codigo', codigos),
      supabase
        .from('estoque_funcoes')
        .select('codigo, precedencia')
        .in('codigo', codigos)
        .order('precedencia', { ascending: false })
        .limit(1),
    ])
    for (const p of porFuncao.data ?? []) permissoes.add(p.permissao_codigo)
    funcao = precedencia.data?.[0]?.codigo ?? null
  }

  return {
    usuarioId: user.id,
    nome: perfil.nome ?? user.email ?? 'Sem nome',
    unidadeId,
    unidadeNome: unidade.data?.nome ?? 'Unidade',
    funcao,
    permissoes,
    emProducao: config.data?.em_producao ?? false,
    setoresVinculados: funcoesVigentes
      .map((f) => f.setor_id)
      .filter((s): s is string => s !== null),
  }
}

export function pode(ctx: Contexto, permissao: string) {
  return ctx.permissoes.has(permissao)
}

/** Pode agir neste setor? Vínculo direto ou permissão ampla. */
export function podeNoSetor(ctx: Contexto, setorId: string, permissao: string) {
  if (!pode(ctx, permissao)) return false
  return (
    pode(ctx, 'pulmao.contar_qualquer') || ctx.setoresVinculados.includes(setorId)
  )
}

export type Setor = { id: string; nome: string; codigo: string; ordem: number }

export async function listarSetores(unidadeId: string): Promise<Setor[]> {
  const supabase = await criarClienteServidor()
  const { data } = await supabase
    .from('estoque_setores')
    .select('id, nome, codigo, ordem')
    .eq('unidade_id', unidadeId)
    .eq('ativo', true)
    .order('ordem')
  return data ?? []
}

export type Item = {
  id: string
  nome: string
  categoria: string | null
  unidade_contagem: string
  orientacao_contagem: string | null
  critico: boolean
}

export async function listarItens(unidadeId: string): Promise<Item[]> {
  const supabase = await criarClienteServidor()
  const { data } = await supabase
    .from('estoque_itens')
    .select('id, nome, categoria, unidade_contagem, orientacao_contagem, critico')
    .eq('unidade_id', unidadeId)
    .eq('ativo', true)
    .order('nome')
  return data ?? []
}

export type Local = {
  id: string
  tipo: string
  nome: string
  setor_id: string | null
}

export async function listarLocais(unidadeId: string): Promise<Local[]> {
  const supabase = await criarClienteServidor()
  const { data } = await supabase
    .from('estoque_locais')
    .select('id, tipo, nome, setor_id')
    .eq('unidade_id', unidadeId)
    .eq('ativo', true)
  return data ?? []
}

/** saldos[localId][itemId] = quantidade */
export async function carregarSaldos(unidadeId: string) {
  const supabase = await criarClienteServidor()
  const { data } = await supabase
    .from('estoque_saldos_locais')
    .select('local_id, item_id, quantidade')
    .eq('unidade_id', unidadeId)

  const mapa: Record<string, Record<string, number>> = {}
  for (const s of data ?? []) {
    if (!s.local_id || !s.item_id) continue
    mapa[s.local_id] ??= {}
    mapa[s.local_id][s.item_id] = Number(s.quantidade ?? 0)
  }
  return mapa
}

export async function contagemDoCiclo(
  unidadeId: string,
  setorId: string,
  ciclo: string,
) {
  const supabase = await criarClienteServidor()
  const { data: contagem } = await supabase
    .from('estoque_contagens')
    .select('id, situacao, aberta_por, lider_responsavel, finalizada_em, ciclo')
    .eq('unidade_id', unidadeId)
    .eq('setor_id', setorId)
    .eq('ciclo', ciclo)
    .maybeSingle()

  if (!contagem) return { contagem: null, itens: [] as ContagemItem[] }

  const { data: itens } = await supabase
    .from('estoque_contagem_itens')
    .select('item_id, quantidade, lancado_em')
    .eq('contagem_id', contagem.id)

  return { contagem, itens: (itens ?? []) as ContagemItem[] }
}

export type ContagemItem = {
  item_id: string
  quantidade: number
  lancado_em: string
}

export async function rodadaDoCiclo(
  unidadeId: string,
  setorId: string,
  ciclo: string,
) {
  const supabase = await criarClienteServidor()
  const { data: rodada } = await supabase
    .from('estoque_rodadas')
    .select(
      'id, situacao, contagem_id, separado_em, recebido_em, separado_por, recebido_por',
    )
    .eq('unidade_id', unidadeId)
    .eq('setor_id', setorId)
    .eq('ciclo', ciclo)
    .maybeSingle()

  if (!rodada) return { rodada: null, itens: [] as RodadaItem[] }

  const { data: itens } = await supabase
    .from('estoque_rodada_itens')
    .select('item_id, qtd_sugerida, qtd_separada, qtd_recebida, motivo_ajuste')
    .eq('rodada_id', rodada.id)

  return { rodada, itens: (itens ?? []) as RodadaItem[] }
}

export type RodadaItem = {
  item_id: string
  qtd_sugerida: number
  qtd_separada: number | null
  qtd_recebida: number | null
  motivo_ajuste: string | null
}

export async function divergenciasPendentes(unidadeId: string) {
  const supabase = await criarClienteServidor()
  const { data } = await supabase
    .from('estoque_divergencias')
    .select(
      'id, setor_id, item_id, origem, quantidade, criada_em, rodada_id, contagem_id',
    )
    .eq('unidade_id', unidadeId)
    .eq('situacao', 'PENDENTE')
    .order('criada_em')
  return data ?? []
}

export async function listarCausas() {
  const supabase = await criarClienteServidor()
  const { data } = await supabase
    .from('estoque_causas_divergencia')
    .select('codigo, nome, aplica_a, exige_motivo, fluxo_destino')
    .order('codigo')
  return data ?? []
}

export async function minimosDoPulmao(unidadeId: string, setorId: string) {
  const supabase = await criarClienteServidor()
  const { data } = await supabase
    .from('estoque_minimo_pulmao')
    .select('item_id, quantidade')
    .eq('unidade_id', unidadeId)
    .eq('setor_id', setorId)
  const mapa: Record<string, number> = {}
  for (const m of data ?? []) mapa[m.item_id] = Number(m.quantidade)
  return mapa
}

export async function minimosDaCasa(unidadeId: string) {
  const supabase = await criarClienteServidor()
  const { data } = await supabase
    .from('estoque_minimo_casa')
    .select('item_id, quantidade')
    .eq('unidade_id', unidadeId)
  const mapa: Record<string, number> = {}
  for (const m of data ?? []) mapa[m.item_id] = Number(m.quantidade)
  return mapa
}

/** Já houve inventário de implantação? Define a tela inicial. */
export async function estadoDaImplantacao(unidadeId: string) {
  const supabase = await criarClienteServidor()
  const [inv, mov] = await Promise.all([
    supabase
      .from('estoque_inventarios')
      .select('id, data_referencia, criado_em')
      .eq('unidade_id', unidadeId)
      .order('criado_em', { ascending: false })
      .limit(1),
    supabase
      .from('estoque_movimentos')
      .select('id', { count: 'exact', head: true })
      .eq('unidade_id', unidadeId)
      .in('fluxo', ['SALDO_INICIAL', 'SALDO_INICIAL_PULMAO']),
  ])
  return {
    inventario: inv.data?.[0] ?? null,
    itensLancados: mov.count ?? 0,
  }
}

export async function carregarExtrato(unidadeId: string, limite = 200) {
  const supabase = await criarClienteServidor()
  const { data } = await supabase
    .from('estoque_movimentos')
    .select(
      'id, item_id, local_origem_id, local_destino_id, quantidade, fluxo, documento_tipo, momento, registrado_por, funcao_exercida, estorno_de',
    )
    .eq('unidade_id', unidadeId)
    .order('momento', { ascending: false })
    .limit(limite)
  return data ?? []
}

export async function carregarTrilha(unidadeId: string, limite = 200) {
  const supabase = await criarClienteServidor()
  const { data } = await supabase
    .from('estoque_eventos')
    .select(
      'id, tipo, ator, funcao_exercida, momento, entidade_tipo, entidade_id, dados_anteriores, dados_novos, observacao',
    )
    .eq('unidade_id', unidadeId)
    .order('momento', { ascending: false })
    .limit(limite)
  return data ?? []
}

/** Nomes de pessoas em lote, para não consultar uma por linha. */
export async function nomesDePessoas(ids: (string | null)[]) {
  const unicos = [...new Set(ids.filter((i): i is string => !!i))]
  if (!unicos.length) return {} as Record<string, string>
  const supabase = await criarClienteServidor()
  const { data } = await supabase
    .from('profiles')
    .select('id, nome')
    .in('id', unicos)
  return Object.fromEntries(
    (data ?? []).map((p) => [p.id, p.nome ?? '—']),
  ) as Record<string, string>
}

export const CICLO_HOJE = () => new Date().toISOString().slice(0, 10)

/**
 * Quem pode ser nomeado líder responsável por uma contagem.
 *
 * RB-012: o líder responde pela contagem do seu setor mesmo quando auxiliares
 * participam. Então a lista é de quem exerce função de liderança, não de quem
 * está com o tablet na mão.
 */
export async function listarLideres(unidadeId: string, setorId?: string) {
  const supabase = await criarClienteServidor()
  const agora = new Date().toISOString()

  let q = supabase
    .from('estoque_pessoa_funcoes')
    .select('pessoa_id, funcao_codigo, setor_id, inicio, fim')
    .eq('unidade_id', unidadeId)
    .in('funcao_codigo', ['LIDER_SETOR', 'SUBCHEFE', 'GERENTE_CPD', 'DIRECAO'])

  if (setorId) q = q.or(`setor_id.eq.${setorId},setor_id.is.null`)

  const { data } = await q
  const vigentes = (data ?? []).filter(
    (r) => r.inicio <= agora && (r.fim === null || r.fim > agora),
  )

  const ids = [...new Set(vigentes.map((r) => r.pessoa_id))]
  if (!ids.length) return []

  const { data: pessoas } = await supabase
    .from('profiles')
    .select('id, nome')
    .in('id', ids)
    .order('nome')

  const funcaoDe = new Map(vigentes.map((r) => [r.pessoa_id, r.funcao_codigo]))
  return (pessoas ?? []).map((p) => ({
    id: p.id,
    nome: p.nome ?? '—',
    funcao: funcaoDe.get(p.id) ?? '',
  }))
}
