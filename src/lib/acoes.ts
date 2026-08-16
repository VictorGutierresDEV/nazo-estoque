'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/server'
import { carregarContexto } from '@/lib/dados'

export type Resultado = { ok: true; id?: string } | { ok: false; erro: string }

type Item = { produto_id: string; quantidade: number; custo_unitario?: number }

/**
 * Lê os itens vindos do formulário.
 *
 * Cada linha chega como `item-<produtoId>` (quantidade) e, na entrada,
 * `custo-<produtoId>`. Linhas em branco são descartadas — o operador
 * costuma abrir várias e preencher só algumas.
 */
function lerItens(dados: FormData, comCusto: boolean): Item[] {
  const itens: Item[] = []

  for (const [chave, valor] of dados.entries()) {
    if (!chave.startsWith('item-')) continue

    const bruto = String(valor).trim().replace(',', '.')
    if (!bruto) continue

    const quantidade = Number(bruto)
    if (!Number.isFinite(quantidade) || quantidade <= 0) continue

    const produtoId = chave.slice('item-'.length)
    const item: Item = { produto_id: produtoId, quantidade }

    if (comCusto) {
      const custoBruto = String(dados.get(`custo-${produtoId}`) ?? '')
        .trim()
        .replace(',', '.')
      const custo = Number(custoBruto)
      if (Number.isFinite(custo) && custo > 0) item.custo_unitario = custo
    }

    itens.push(item)
  }

  return itens
}

/** Mensagem do Postgres é mais útil que "erro inesperado" — ela cita o produto. */
function traduzir(mensagem: string) {
  if (mensagem.includes('Saldo insuficiente')) return mensagem
  if (mensagem.includes('Sem permissão'))
    return 'Seu usuário não tem permissão para registrar movimentos nesta unidade.'
  if (mensagem.includes('estoque_saida_exige_responsavel'))
    return 'Toda saída precisa de praça e de quem retirou.'
  return mensagem
}

export async function registrarSaida(
  _anterior: Resultado | null,
  dados: FormData,
): Promise<Resultado> {
  const contexto = await carregarContexto()
  if (!contexto) return { ok: false, erro: 'Sessão expirada. Entre de novo.' }
  if (!contexto.podeOperar)
    return { ok: false, erro: 'Seu perfil não registra movimento de estoque.' }

  const pracaId = String(dados.get('praca_id') ?? '')
  const retiradoPor = String(dados.get('retirado_por') ?? '')

  if (!pracaId) return { ok: false, erro: 'Escolha a praça de destino.' }
  if (!retiradoPor) return { ok: false, erro: 'Escolha quem está retirando.' }

  const itens = lerItens(dados, false)
  if (!itens.length)
    return { ok: false, erro: 'Informe a quantidade de ao menos um item.' }

  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.rpc('estoque_registrar_saida', {
    p_unidade_id: contexto.unidadeId,
    p_praca_id: pracaId,
    p_retirado_por: retiradoPor,
    p_itens: itens,
    p_observacao: String(dados.get('observacao') ?? '') || undefined,
  })

  if (error) return { ok: false, erro: traduzir(error.message) }

  revalidatePath('/')
  revalidatePath('/extrato')
  return { ok: true, id: data as string }
}

export async function registrarEntrada(
  _anterior: Resultado | null,
  dados: FormData,
): Promise<Resultado> {
  const contexto = await carregarContexto()
  if (!contexto) return { ok: false, erro: 'Sessão expirada. Entre de novo.' }
  if (!contexto.podeOperar)
    return { ok: false, erro: 'Seu perfil não registra movimento de estoque.' }

  const itens = lerItens(dados, true)
  if (!itens.length)
    return { ok: false, erro: 'Informe a quantidade de ao menos um item.' }

  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.rpc('estoque_registrar_entrada', {
    p_unidade_id: contexto.unidadeId,
    p_itens: itens,
    p_fornecedor: String(dados.get('fornecedor') ?? '') || undefined,
    p_documento: String(dados.get('documento') ?? '') || undefined,
    p_observacao: String(dados.get('observacao') ?? '') || undefined,
  })

  if (error) return { ok: false, erro: traduzir(error.message) }

  revalidatePath('/')
  revalidatePath('/extrato')
  return { ok: true, id: data as string }
}

export async function estornar(
  _anterior: Resultado | null,
  dados: FormData,
): Promise<Resultado> {
  const supabase = await criarClienteServidor()
  const { error } = await supabase.rpc('estoque_estornar', {
    p_transacao_id: String(dados.get('transacao_id') ?? ''),
    p_motivo: String(dados.get('motivo') ?? ''),
  })

  if (error) return { ok: false, erro: traduzir(error.message) }

  revalidatePath('/')
  revalidatePath('/extrato')
  return { ok: true }
}

export async function salvarProduto(
  _anterior: Resultado | null,
  dados: FormData,
): Promise<Resultado> {
  const contexto = await carregarContexto()
  if (!contexto) return { ok: false, erro: 'Sessão expirada. Entre de novo.' }

  const nome = String(dados.get('nome') ?? '').trim()
  if (!nome) return { ok: false, erro: 'O produto precisa de nome.' }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('estoque_produtos').insert({
    unidade_id: contexto.unidadeId,
    nome,
    categoria: String(dados.get('categoria') ?? '').trim() || null,
    unidade_medida: String(dados.get('unidade_medida') ?? 'un').trim() || 'un',
    estoque_minimo: Number(
      String(dados.get('estoque_minimo') ?? '0').replace(',', '.'),
    ) || 0,
  })

  if (error) {
    if (error.code === '23505')
      return { ok: false, erro: `Já existe um produto chamado "${nome}".` }
    return { ok: false, erro: traduzir(error.message) }
  }

  revalidatePath('/produtos')
  revalidatePath('/entrada')
  revalidatePath('/saida')
  return { ok: true }
}

export async function salvarPraca(
  _anterior: Resultado | null,
  dados: FormData,
): Promise<Resultado> {
  const contexto = await carregarContexto()
  if (!contexto) return { ok: false, erro: 'Sessão expirada. Entre de novo.' }

  const nome = String(dados.get('nome') ?? '').trim()
  if (!nome) return { ok: false, erro: 'A praça precisa de nome.' }

  const codigo =
    String(dados.get('codigo') ?? '')
      .trim()
      .toUpperCase() ||
    nome
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .slice(0, 12)

  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('estoque_pracas').insert({
    unidade_id: contexto.unidadeId,
    nome,
    codigo,
    ordem: Number(String(dados.get('ordem') ?? '0')) || 0,
  })

  if (error) {
    if (error.code === '23505')
      return { ok: false, erro: `Já existe uma praça com o código "${codigo}".` }
    return { ok: false, erro: traduzir(error.message) }
  }

  revalidatePath('/pracas')
  revalidatePath('/saida')
  return { ok: true }
}

export async function sair() {
  const supabase = await criarClienteServidor()
  await supabase.auth.signOut()
}
