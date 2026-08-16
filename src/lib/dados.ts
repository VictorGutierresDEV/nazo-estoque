import { criarClienteServidor } from '@/lib/supabase/server'

export type Contexto = {
  usuarioId: string
  nome: string
  papel: string
  unidadeId: string
  unidadeNome: string
  podeOperar: boolean
}

const PAPEIS_OPERADORES = ['owner', 'manager', 'leader', 'subleader', 'estoque']

/**
 * Quem é o usuário e em qual unidade ele está operando.
 *
 * A unidade vem de profiles.unidade_ativa — o mesmo campo que o nazo-gestao
 * usa. Assim as duas telas ficam sempre na mesma loja, sem um segundo seletor
 * para o gerente esquecer de trocar.
 */
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

  const { data: unidade } = await supabase
    .from('unidades')
    .select('nome')
    .eq('id', unidadeId)
    .single()

  return {
    usuarioId: user.id,
    nome: perfil.nome ?? user.email ?? 'Sem nome',
    papel: perfil.role ?? '',
    unidadeId,
    unidadeNome: unidade?.nome ?? 'Unidade',
    podeOperar:
      (perfil.ativo ?? true) && PAPEIS_OPERADORES.includes(perfil.role ?? ''),
  }
}

export async function listarPracas(unidadeId: string) {
  const supabase = await criarClienteServidor()
  const { data } = await supabase
    .from('estoque_pracas')
    .select('id, nome, codigo, ordem')
    .eq('unidade_id', unidadeId)
    .eq('ativo', true)
    .order('ordem')
    .order('nome')
  return data ?? []
}

export async function listarProdutos(unidadeId: string) {
  const supabase = await criarClienteServidor()
  const { data } = await supabase
    .from('estoque_produtos')
    .select('id, nome, categoria, unidade_medida, estoque_minimo, custo_medio')
    .eq('unidade_id', unidadeId)
    .eq('ativo', true)
    .order('nome')
  return data ?? []
}

/**
 * Colaboradores ativos da unidade — a lista de QUEM pode retirar.
 *
 * Vem do cadastro de RH do nazo-gestao. É de propósito: o auxiliar de cozinha
 * não tem login, mas tem ficha. É isso que torna o registro nominal sem
 * precisar dar acesso ao sistema para a operação inteira.
 */
export async function listarColaboradores(unidadeId: string) {
  const supabase = await criarClienteServidor()
  const { data } = await supabase
    .from('colaboradores')
    .select('id, nome_completo, cargo, setor')
    .eq('unidade_id', unidadeId)
    .eq('status', 'ativo')
    .order('nome_completo')
  return data ?? []
}

export type LinhaSaldo = {
  produtoId: string
  nome: string
  categoria: string | null
  unidadeMedida: string
  estoqueMinimo: number
  custoMedio: number
  central: number
  pracas: Record<string, number>
  total: number
}

/**
 * Saldo por produto, separando o Estoque Central do pulmão de cada praça.
 *
 * Os saldos são somados do razão (view estoque_saldos), nunca digitados —
 * é o que garante que a tela sempre bata com o histórico.
 */
export async function carregarSaldos(unidadeId: string): Promise<LinhaSaldo[]> {
  const supabase = await criarClienteServidor()

  const [{ data: saldos }, produtos] = await Promise.all([
    supabase
      .from('estoque_saldos')
      .select('produto_id, praca_id, quantidade')
      .eq('unidade_id', unidadeId),
    listarProdutos(unidadeId),
  ])

  const porProduto = new Map<string, LinhaSaldo>()
  for (const p of produtos) {
    porProduto.set(p.id, {
      produtoId: p.id,
      nome: p.nome,
      categoria: p.categoria,
      unidadeMedida: p.unidade_medida,
      estoqueMinimo: Number(p.estoque_minimo ?? 0),
      custoMedio: Number(p.custo_medio ?? 0),
      central: 0,
      pracas: {},
      total: 0,
    })
  }

  for (const s of saldos ?? []) {
    const linha = porProduto.get(s.produto_id!)
    if (!linha) continue
    const qtd = Number(s.quantidade ?? 0)
    if (s.praca_id) linha.pracas[s.praca_id] = qtd
    else linha.central = qtd
    linha.total += qtd
  }

  return [...porProduto.values()].sort((a, b) => a.nome.localeCompare(b.nome))
}

export async function carregarExtrato(unidadeId: string, limite = 100) {
  const supabase = await criarClienteServidor()

  const { data: linhas } = await supabase
    .from('estoque_extrato')
    .select('*')
    .eq('unidade_id', unidadeId)
    .order('ocorrido_em', { ascending: false })
    .limit(limite)

  if (!linhas?.length) return []

  // A view não embute nomes de pessoa (são de outro módulo), então
  // resolvemos os ids em lote — uma consulta, não uma por linha.
  const idsColaborador = [
    ...new Set(linhas.map((l) => l.retirado_por).filter(Boolean)),
  ] as string[]
  const idsPerfil = [
    ...new Set(linhas.map((l) => l.registrado_por).filter(Boolean)),
  ] as string[]

  const [colaboradores, perfis] = await Promise.all([
    idsColaborador.length
      ? supabase
          .from('colaboradores')
          .select('id, nome_completo')
          .in('id', idsColaborador)
      : Promise.resolve({ data: [] }),
    idsPerfil.length
      ? supabase.from('profiles').select('id, nome').in('id', idsPerfil)
      : Promise.resolve({ data: [] }),
  ])

  const nomeColab = new Map(
    (colaboradores.data ?? []).map((c) => [c.id, c.nome_completo]),
  )
  const nomePerfil = new Map((perfis.data ?? []).map((p) => [p.id, p.nome]))

  return linhas.map((l) => ({
    ...l,
    retirado_por_nome: l.retirado_por ? nomeColab.get(l.retirado_por) ?? null : null,
    registrado_por_nome: l.registrado_por
      ? nomePerfil.get(l.registrado_por) ?? null
      : null,
  }))
}
