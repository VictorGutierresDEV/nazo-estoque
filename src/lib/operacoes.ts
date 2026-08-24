'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/server'
import { carregarContexto } from '@/lib/estoque'

/**
 * Escrita da Etapa 1.
 *
 * Toda ação aqui é uma casca fina em volta de uma função do banco. A regra de
 * negócio mora lá, não aqui: quem valida permissão, saldo, causa e destino é o
 * Postgres. Isso é deliberado — se a regra vivesse nesta camada, um segundo
 * cliente (script, integração, outra tela) a contornaria sem esforço.
 */

export type Resultado<T = unknown> =
  | { ok: true; dados?: T }
  | { ok: false; erro: string }

function traduzir(mensagem: string): string {
  const m = mensagem.replace(/^.*?ERROR:\s*[A-Z0-9]*:?\s*/i, '')
  if (m.includes('Sem permissão')) return m
  if (m.includes('já finalizada')) return m
  if (m.includes('Saldo insuficiente')) return m
  return m || 'Não foi possível concluir. Tente de novo.'
}

function revalidar() {
  for (const rota of [
    '/',
    '/contagem',
    '/abastecimento',
    '/divergencias',
    '/minimos',
    '/implantacao',
    '/extrato',
  ]) {
    revalidatePath(rota)
  }
}

async function chamar<T>(
  nome: string,
  args: Record<string, unknown>,
): Promise<Resultado<T>> {
  const ctx = await carregarContexto()
  if (!ctx) return { ok: false, erro: 'Sessão expirada. Entre de novo.' }

  const supabase = await criarClienteServidor()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)(nome, args)

  if (error) return { ok: false, erro: traduzir(error.message) }
  revalidar()
  return { ok: true, dados: data as T }
}

// ---------------------------------------------------------------------------
// Implantação
// ---------------------------------------------------------------------------

export async function lancarInventarioImplantacao(
  itens: { item_id: string; quantidade: number; setor_id: string | null }[],
  observacao?: string,
): Promise<Resultado<{ inventario_id: string; itens: number }>> {
  const ctx = await carregarContexto()
  if (!ctx) return { ok: false, erro: 'Sessão expirada. Entre de novo.' }
  if (!itens.length) return { ok: false, erro: 'Nenhuma quantidade informada.' }

  return chamar('estoque_lancar_inventario_implantacao', {
    p_unidade_id: ctx.unidadeId,
    p_itens: itens,
    p_observacao: observacao || null,
  })
}

export async function concluirInventarioLocal(
  localId: string,
): Promise<Resultado<string>> {
  const ctx = await carregarContexto()
  if (!ctx) return { ok: false, erro: 'Sessão expirada. Entre de novo.' }
  return chamar('estoque_concluir_inventario_local', {
    p_unidade_id: ctx.unidadeId,
    p_local_id: localId,
  })
}

export async function marcarEmProducao(): Promise<Resultado> {
  const ctx = await carregarContexto()
  if (!ctx) return { ok: false, erro: 'Sessão expirada. Entre de novo.' }
  return chamar('estoque_marcar_em_producao', { p_unidade_id: ctx.unidadeId })
}

// ---------------------------------------------------------------------------
// Contagem do pulmão
// ---------------------------------------------------------------------------

export async function abrirContagem(
  setorId: string,
  ciclo: string,
): Promise<Resultado<string>> {
  const ctx = await carregarContexto()
  if (!ctx) return { ok: false, erro: 'Sessão expirada. Entre de novo.' }
  return chamar('estoque_abrir_contagem', {
    p_unidade_id: ctx.unidadeId,
    p_setor_id: setorId,
    p_ciclo: ciclo,
  })
}

export async function lancarContagemItem(
  contagemId: string,
  itemId: string,
  quantidade: number,
): Promise<Resultado> {
  return chamar('estoque_lancar_contagem_item', {
    p_contagem_id: contagemId,
    p_item_id: itemId,
    p_quantidade: quantidade,
  })
}

export async function finalizarContagem(
  contagemId: string,
  liderResponsavel: string,
): Promise<Resultado<{ saidas_nao_discriminadas: number; divergencias_abertas: number }>> {
  return chamar('estoque_finalizar_contagem', {
    p_contagem_id: contagemId,
    p_lider_responsavel: liderResponsavel,
  })
}

// ---------------------------------------------------------------------------
// Abastecimento
// ---------------------------------------------------------------------------

export async function gerarRodada(contagemId: string): Promise<Resultado<string>> {
  return chamar('estoque_gerar_rodada', { p_contagem_id: contagemId })
}

export async function ajustarSeparacao(
  rodadaId: string,
  itemId: string,
  quantidade: number,
  motivo?: string,
): Promise<Resultado> {
  return chamar('estoque_ajustar_separacao', {
    p_rodada_id: rodadaId,
    p_item_id: itemId,
    p_quantidade: quantidade,
    p_motivo: motivo || null,
  })
}

export async function confirmarSeparacao(
  rodadaId: string,
): Promise<Resultado<number>> {
  return chamar('estoque_confirmar_separacao', { p_rodada_id: rodadaId })
}

export async function confirmarRecebimento(
  rodadaId: string,
  itens: { item_id: string; quantidade: number }[],
): Promise<Resultado<{ itens_recebidos: number; divergencias_abertas: number }>> {
  return chamar('estoque_confirmar_recebimento', {
    p_rodada_id: rodadaId,
    p_itens: itens,
  })
}

// ---------------------------------------------------------------------------
// Divergências
// ---------------------------------------------------------------------------

export async function apurarDivergencia(
  divergenciaId: string,
  causa: string,
  motivo?: string,
): Promise<Resultado> {
  return chamar('estoque_apurar_divergencia', {
    p_divergencia_id: divergenciaId,
    p_causa: causa,
    p_motivo: motivo || null,
  })
}

// ---------------------------------------------------------------------------
// Parâmetros
// ---------------------------------------------------------------------------

export async function definirMinimoPulmao(
  setorId: string,
  itemId: string,
  quantidade: number,
  justificativa?: string,
): Promise<Resultado> {
  const ctx = await carregarContexto()
  if (!ctx) return { ok: false, erro: 'Sessão expirada. Entre de novo.' }
  return chamar('estoque_definir_minimo_pulmao', {
    p_unidade_id: ctx.unidadeId,
    p_setor_id: setorId,
    p_item_id: itemId,
    p_quantidade: quantidade,
    p_justificativa: justificativa || null,
  })
}

export async function definirMinimoCasa(
  itemId: string,
  quantidade: number,
  justificativa?: string,
): Promise<Resultado> {
  const ctx = await carregarContexto()
  if (!ctx) return { ok: false, erro: 'Sessão expirada. Entre de novo.' }
  return chamar('estoque_definir_minimo_casa', {
    p_unidade_id: ctx.unidadeId,
    p_item_id: itemId,
    p_quantidade: quantidade,
    p_justificativa: justificativa || null,
  })
}

export async function sugerirMinimo(
  parametro: 'MINIMO_PULMAO' | 'MINIMO_CASA',
  itemId: string,
  valorProposto: number,
  motivo: string,
  setorId?: string,
): Promise<Resultado> {
  const ctx = await carregarContexto()
  if (!ctx) return { ok: false, erro: 'Sessão expirada. Entre de novo.' }
  return chamar('estoque_sugerir_minimo', {
    p_unidade_id: ctx.unidadeId,
    p_parametro: parametro,
    p_item_id: itemId,
    p_valor_proposto: valorProposto,
    p_motivo: motivo,
    p_setor_id: setorId || null,
  })
}

export async function sair() {
  const supabase = await criarClienteServidor()
  await supabase.auth.signOut()
}
