'use server'

import ExcelJS from 'exceljs'
import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/server'
import { carregarContexto, pode } from '@/lib/estoque'
import {
  detectarColunas,
  normalizar,
  type Campo,
  type ProdutoImportado,
} from '@/lib/importacao'

/**
 * Importação do CATÁLOGO de itens.
 *
 * Só cadastro: nome, categoria, unidade de contagem, código de barras. Saldo
 * NÃO entra por aqui — a origem de saldo é o inventário de implantação, e
 * depois disso só movimentação. Colunas de quantidade e custo na planilha são
 * lidas e ignoradas de propósito.
 */

function valorSimples(valor: unknown): string | number | null {
  if (valor === null || valor === undefined) return null
  if (typeof valor === 'string' || typeof valor === 'number') return valor
  if (typeof valor === 'boolean') return valor ? 'sim' : 'nao'
  if (valor instanceof Date) return valor.toISOString().slice(0, 10)

  const obj = valor as Record<string, unknown>
  if ('result' in obj) return valorSimples(obj.result)
  if ('text' in obj) return valorSimples(obj.text)
  if ('hyperlink' in obj) return valorSimples(obj.text ?? obj.hyperlink)
  if ('richText' in obj && Array.isArray(obj.richText))
    return obj.richText.map((p) => (p as { text?: string }).text ?? '').join('')
  if ('error' in obj) return null

  return String(valor)
}

export type RespostaAnalise =
  | {
      ok: true
      cabecalho: string[]
      linhas: (string | number | null)[][]
      mapa: Record<Campo, number>
      produtos: ProdutoImportado[]
      problemas: { linha: number; motivo: string }[]
      aba: string
    }
  | { ok: false; erro: string }

export async function analisarPlanilha(
  _anterior: RespostaAnalise | null,
  dados: FormData,
): Promise<RespostaAnalise> {
  const ctx = await carregarContexto()
  if (!ctx) return { ok: false, erro: 'Sessão expirada. Entre de novo.' }
  if (!pode(ctx, 'cadastro.gerenciar'))
    return { ok: false, erro: 'Seu perfil não cadastra itens.' }

  const arquivo = dados.get('arquivo')
  if (!(arquivo instanceof File) || arquivo.size === 0)
    return { ok: false, erro: 'Escolha um arquivo .xlsx ou .csv.' }

  if (arquivo.size > 8 * 1024 * 1024)
    return { ok: false, erro: 'Arquivo acima de 8 MB. Reduza a planilha.' }

  const buffer = Buffer.from(await arquivo.arrayBuffer())
  const ehCsv = arquivo.name.toLowerCase().endsWith('.csv')

  const wb = new ExcelJS.Workbook()
  try {
    if (ehCsv) {
      const { Readable } = await import('node:stream')
      await wb.csv.read(Readable.from(buffer.toString('utf8')))
    } else {
      type CargaXlsx = Parameters<typeof wb.xlsx.load>[0]
      await wb.xlsx.load(buffer as unknown as CargaXlsx)
    }
  } catch {
    return {
      ok: false,
      erro: 'Não consegui abrir o arquivo. Salve como .xlsx ou .csv e tente de novo.',
    }
  }

  const planilha = wb.worksheets[0]
  if (!planilha || planilha.rowCount === 0)
    return { ok: false, erro: 'A planilha está vazia.' }

  const grade: (string | number | null)[][] = []
  planilha.eachRow({ includeEmpty: false }, (linha) => {
    const valores = Array.isArray(linha.values) ? linha.values.slice(1) : []
    grade.push(valores.map(valorSimples))
  })

  if (grade.length < 2)
    return {
      ok: false,
      erro: 'A planilha precisa de uma linha de cabeçalho e ao menos um item.',
    }

  const [cabecalhoBruto, ...linhas] = grade
  const cabecalho = cabecalhoBruto.map((c) => String(c ?? '').trim())
  const mapa = detectarColunas(cabecalho)

  if (mapa.nome < 0)
    return {
      ok: false,
      erro:
        'Não achei a coluna com o nome do item. Renomeie o cabeçalho para "Produto" ou "Item", ou ajuste o vínculo na tela.',
    }

  const { produtos, problemas } = normalizar(linhas, mapa)

  return {
    ok: true,
    cabecalho,
    linhas,
    mapa,
    produtos,
    problemas,
    aba: planilha.name,
  }
}

export type RespostaImportacao =
  | { ok: true; criados: number; atualizados: number }
  | { ok: false; erro: string }

/**
 * Grava o catálogo. Reimportar é seguro: o item é casado por (unidade, nome) e
 * apenas atualizado.
 */
export async function importarItens(
  itens: ProdutoImportado[],
): Promise<RespostaImportacao> {
  const ctx = await carregarContexto()
  if (!ctx) return { ok: false, erro: 'Sessão expirada. Entre de novo.' }
  if (!pode(ctx, 'cadastro.gerenciar'))
    return { ok: false, erro: 'Seu perfil não cadastra itens.' }
  if (!itens.length) return { ok: false, erro: 'Nada para importar.' }

  const supabase = await criarClienteServidor()

  const { data: existentes } = await supabase
    .from('estoque_itens')
    .select('nome')
    .eq('unidade_id', ctx.unidadeId)

  const jaExistia = new Set((existentes ?? []).map((p) => p.nome))

  const { error } = await supabase.from('estoque_itens').upsert(
    itens.map((p) => ({
      unidade_id: ctx.unidadeId,
      nome: p.nome,
      categoria: p.categoria,
      unidade_contagem: p.unidade_medida,
      ean: p.ean,
      ativo: true,
    })),
    { onConflict: 'unidade_id,nome' },
  )

  if (error) return { ok: false, erro: error.message }

  const atualizados = itens.filter((p) => jaExistia.has(p.nome)).length

  revalidatePath('/itens')
  revalidatePath('/implantacao')
  revalidatePath('/minimos')

  return { ok: true, criados: itens.length - atualizados, atualizados }
}
