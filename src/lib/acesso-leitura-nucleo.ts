// Leitura por unidade em foco e setor (v57 do Nazo Gestão, a "D4").
//
// Com a v57, a RLS passa a filtrar a leitura: a gestão da unidade em foco
// (direção, CPD, gerente do Back, estoquista, owner/manager do Gestão) lê o
// razão, os saldos, os inventários e todos os setores; os demais papéis leem
// só os seus setores, e razão, saldos e inventários chegam VAZIOS — sem erro.
// Uma tela que lesse esse vazio como "zero" mentiria. Este arquivo pergunta ao
// banco em que modo está e quem é a pessoa, para as telas não confundirem
// "não posso ver" com "não existe".
//
// O app é publicado ANTES da migração: sem ela, o PostgREST responde
// PGRST202 (função não encontrada) e o app fica no modo legado, exatamente
// como antes. Qualquer outro erro é falha de leitura e é lançado — nunca vira
// lista vazia, zero ou `false` em silêncio.
//
// Sem o Next nem o Supabase, para ser testado fora deles
// (scripts/teste-acesso-leitura.ts). O cache por requisição e o cliente de
// verdade ficam em acesso-leitura.ts.

export type ModoLeitura = 'legado' | 'v57'

export type AcessoLeitura = {
  modo: ModoLeitura
  /** No modo legado é sempre `true`: a leitura é a de antes da v57. */
  gestao: boolean
}

export const FUNCAO_AUSENTE = 'PGRST202'

export type ErroPostgrest = {
  code?: string | null
  message?: string | null
  details?: string | null
  hint?: string | null
}

export type RespostaRpc = { data: unknown; error: ErroPostgrest | null }

export type ClienteRpc = {
  rpc(nome: string, args: Record<string, unknown>): PromiseLike<RespostaRpc>
}

export class ErroDeLeitura extends Error {
  readonly codigo: string | null

  constructor(oQue: string, erro: ErroPostgrest | null) {
    const detalhe = erro?.message ? `: ${erro.message}` : ''
    const codigo = erro?.code ? ` (${erro.code})` : ''
    super(`Não foi possível ler ${oQue}${detalhe}${codigo}`)
    this.name = 'ErroDeLeitura'
    this.codigo = erro?.code ?? null
  }
}

/** A função da v57 não existe no banco: a migração ainda não foi aplicada. */
export function funcaoAusente(erro: ErroPostgrest | null | undefined): boolean {
  return erro?.code === FUNCAO_AUSENTE
}

/** Lança se a leitura falhou. Para os `select` comuns das telas. */
export function semErro(oQue: string, erro: ErroPostgrest | null | undefined) {
  if (erro) throw new ErroDeLeitura(oQue, erro)
}

/** A pessoa lê só os seus setores (v57 e fora da gestão). */
export function leituraRestrita(acesso: AcessoLeitura): boolean {
  return acesso.modo === 'v57' && !acesso.gestao
}

export async function lerAcesso(
  cliente: ClienteRpc,
  unidadeId: string,
): Promise<AcessoLeitura> {
  const { data, error } = await cliente.rpc('estoque_d4_gestao', {
    p_unidade_id: unidadeId,
  })
  if (funcaoAusente(error)) return { modo: 'legado', gestao: true }
  semErro('o seu acesso de leitura', error)
  if (typeof data !== 'boolean') {
    throw new ErroDeLeitura('o seu acesso de leitura', {
      message: 'resposta inesperada do banco',
    })
  }
  return { modo: 'v57', gestao: data }
}

/**
 * Há saldo inicial lançado na unidade? `null` = função ausente (modo legado):
 * quem chamou volta à leitura antiga.
 */
export async function lerUnidadeImplantada(
  cliente: ClienteRpc,
  unidadeId: string,
): Promise<boolean | null> {
  const { data, error } = await cliente.rpc('estoque_d4_unidade_implantada', {
    p_unidade_id: unidadeId,
  })
  if (funcaoAusente(error)) return null
  semErro('se a unidade já foi implantada', error)
  if (typeof data !== 'boolean') {
    throw new ErroDeLeitura('se a unidade já foi implantada', {
      message: 'resposta inesperada do banco',
    })
  }
  return data
}

/**
 * Itens com saldo > 0 no pulmão do setor, sem quantidade. `null` = função
 * ausente (modo legado): quem chamou volta à leitura antiga dos saldos.
 *
 * `setof uuid` chega do PostgREST como lista de strings; a forma de objeto
 * (`{ estoque_d4_itens_com_saldo_pulmao: uuid }`) também é aceita. Qualquer
 * outra coisa é falha, não lista vazia.
 */
export async function lerItensComSaldoNoPulmao(
  cliente: ClienteRpc,
  setorId: string,
): Promise<string[] | null> {
  const nome = 'estoque_d4_itens_com_saldo_pulmao'
  const { data, error } = await cliente.rpc(nome, { p_setor_id: setorId })
  if (funcaoAusente(error)) return null
  semErro('os itens com saldo no pulmão', error)
  if (data === null) return []
  if (!Array.isArray(data)) {
    throw new ErroDeLeitura('os itens com saldo no pulmão', {
      message: 'resposta inesperada do banco',
    })
  }
  return data.map((linha) => {
    if (typeof linha === 'string') return linha
    const valor =
      linha && typeof linha === 'object'
        ? (linha as Record<string, unknown>)[nome]
        : undefined
    if (typeof valor === 'string') return valor
    throw new ErroDeLeitura('os itens com saldo no pulmão', {
      message: 'resposta inesperada do banco',
    })
  })
}

/**
 * O setor pedido na URL, ou o primeiro visível. No modo v57, pedir um setor
 * fora da lista não troca em silêncio: a tela avisa. No legado, como antes.
 */
export function escolherSetor(
  setores: { id: string }[],
  pedido: unknown,
  acesso: AcessoLeitura,
): { setorId: string; foraDoAcesso: boolean } {
  const valido =
    typeof pedido === 'string' && setores.some((s) => s.id === pedido)
  return {
    setorId: valido ? (pedido as string) : (setores[0]?.id ?? ''),
    foraDoAcesso:
      acesso.modo === 'v57' &&
      typeof pedido === 'string' &&
      pedido !== '' &&
      !valido,
  }
}

export const MENSAGEM_SEM_SETOR_VISIVEL =
  'Nenhum setor visível para o seu perfil. Fale com a gestão da unidade.'
export const MENSAGEM_SETOR_FORA_DO_ACESSO =
  'Esse setor não está no seu acesso. Mostrando o primeiro setor visível para você.'
export const MENSAGEM_RESERVADO = 'reservado à gestão e ao CPD'
