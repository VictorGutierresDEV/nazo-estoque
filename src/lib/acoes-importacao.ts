'use server'

import ExcelJS from 'exceljs'
import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/server'
import { carregarContexto } from '@/lib/dados'
import {
  detectarColunas,
  normalizar,
  type Campo,
  type ProdutoImportado,
} from '@/lib/importacao'

/** exceljs devolve objeto em célula com fórmula, link ou texto rico. */
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
  const contexto = await carregarContexto()
  if (!contexto) return { ok: false, erro: 'Sessão expirada. Entre de novo.' }
  if (!contexto.podeOperar)
    return { ok: false, erro: 'Seu perfil não cadastra produtos.' }

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
      // exceljs declara o parâmetro com uma versão de Buffer diferente da que
      // o @types/node atual expõe. É o mesmo objeto em runtime, então tipamos
      // pela própria assinatura em vez de cravar um cast largo.
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
      erro: 'A planilha precisa de uma linha de cabeçalho e ao menos um produto.',
    }

  const [cabecalhoBruto, ...linhas] = grade
  const cabecalho = cabecalhoBruto.map((c) => String(c ?? '').trim())
  const mapa = detectarColunas(cabecalho)

  if (mapa.nome < 0)
    return {
      ok: false,
      erro:
        'Não achei a coluna com o nome do produto. Renomeie o cabeçalho para "Produto" ou "Nome", ou ajuste o vínculo na tela.',
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
  | { ok: true; criados: number; atualizados: number; comSaldo: number; pulados: number }
  | { ok: false; erro: string }

/**
 * Grava os produtos.
 *
 * Reimportar a mesma planilha é seguro: o produto é casado por (unidade, nome)
 * e apenas atualizado. O saldo inicial só entra para produto que ainda não tem
 * NENHUM movimento — sem essa trava, reimportar dobraria o estoque, que é o
 * tipo de erro silencioso que destrói a confiança no número.
 */
export async function importarProdutos(
  produtos: ProdutoImportado[],
  registrarSaldo: boolean,
): Promise<RespostaImportacao> {
  const contexto = await carregarContexto()
  if (!contexto) return { ok: false, erro: 'Sessão expirada. Entre de novo.' }
  if (!contexto.podeOperar)
    return { ok: false, erro: 'Seu perfil não cadastra produtos.' }
  if (!produtos.length) return { ok: false, erro: 'Nada para importar.' }

  const supabase = await criarClienteServidor()

  const { data: existentes } = await supabase
    .from('estoque_produtos')
    .select('id, nome')
    .eq('unidade_id', contexto.unidadeId)

  const jaExistia = new Set((existentes ?? []).map((p) => p.nome))

  const { data: gravados, error } = await supabase
    .from('estoque_produtos')
    .upsert(
      produtos.map((p) => ({
        unidade_id: contexto.unidadeId,
        nome: p.nome,
        categoria: p.categoria,
        unidade_medida: p.unidade_medida,
        estoque_minimo: p.estoque_minimo,
        ean: p.ean,
        ativo: true,
      })),
      { onConflict: 'unidade_id,nome' },
    )
    .select('id, nome')

  if (error) return { ok: false, erro: error.message }

  const idPorNome = new Map((gravados ?? []).map((p) => [p.nome, p.id]))
  const atualizados = produtos.filter((p) => jaExistia.has(p.nome)).length
  const criados = produtos.length - atualizados

  let comSaldo = 0
  let pulados = 0

  if (registrarSaldo) {
    const candidatos = produtos.filter(
      (p) => p.saldo_inicial > 0 && idPorNome.has(p.nome),
    )

    if (candidatos.length) {
      const ids = candidatos.map((p) => idPorNome.get(p.nome)!)

      const { data: comMovimento } = await supabase
        .from('estoque_lancamentos')
        .select('produto_id')
        .eq('unidade_id', contexto.unidadeId)
        .in('produto_id', ids)

      const bloqueados = new Set((comMovimento ?? []).map((l) => l.produto_id))

      const itens = candidatos
        .filter((p) => !bloqueados.has(idPorNome.get(p.nome)!))
        .map((p) => ({
          produto_id: idPorNome.get(p.nome)!,
          quantidade: p.saldo_inicial,
          custo_unitario: p.custo_unitario,
        }))

      pulados = candidatos.length - itens.length

      if (itens.length) {
        const { error: erroEntrada } = await supabase.rpc(
          'estoque_registrar_entrada',
          {
            p_unidade_id: contexto.unidadeId,
            p_itens: itens,
            p_fornecedor: 'Saldo inicial',
            p_documento: 'Importação de planilha',
            p_observacao: 'Abertura de estoque via importação',
          },
        )
        if (erroEntrada) return { ok: false, erro: erroEntrada.message }
        comSaldo = itens.length
      }
    }
  }

  revalidatePath('/')
  revalidatePath('/produtos')
  revalidatePath('/entrada')
  revalidatePath('/saida')

  return { ok: true, criados, atualizados, comSaldo, pulados }
}
