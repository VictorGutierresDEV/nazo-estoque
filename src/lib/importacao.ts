/**
 * Leitura de planilha de produtos.
 *
 * O modelo da planilha é definido pela operação, não pelo código. Por isso o
 * casamento de colunas é por sinônimo, e não por posição fixa: se a coluna se
 * chamar "Produto", "Descrição" ou "Item", todas caem no mesmo campo. Quando
 * a detecção erra, a tela deixa corrigir antes de gravar.
 *
 * Mesma abordagem que o nazo-gestao já usa para importar colaboradores.
 */

export const CAMPOS = [
  'nome',
  'categoria',
  'unidade_medida',
  'estoque_minimo',
  'ean',
  'saldo_inicial',
  'custo_unitario',
] as const

export type Campo = (typeof CAMPOS)[number]

export const ROTULO_CAMPO: Record<Campo, string> = {
  nome: 'Nome do produto',
  categoria: 'Categoria',
  unidade_medida: 'Unidade de medida',
  estoque_minimo: 'Estoque mínimo',
  ean: 'Código de barras',
  saldo_inicial: 'Saldo inicial',
  custo_unitario: 'Custo unitário',
}

export const CAMPO_OBRIGATORIO: Campo[] = ['nome']

const SINONIMOS: Record<Campo, string[]> = {
  nome: [
    'nome', 'produto', 'descricao', 'descricaodoproduto', 'item', 'insumo',
    'material', 'mercadoria', 'nomedoproduto', 'descricaoitem',
  ],
  categoria: [
    'categoria', 'grupo', 'familia', 'classe', 'tipo', 'segmento',
    'grupodeproduto', 'linha',
  ],
  unidade_medida: [
    'unidade', 'un', 'und', 'umedida', 'unidademedida', 'unidadedemedida',
    'medida', 'embalagem', 'uni', 'unmed',
  ],
  estoque_minimo: [
    'minimo', 'estoqueminimo', 'min', 'qtdminima', 'quantidademinima',
    'pontodepedido', 'estoqueseguranca', 'minimoestoque',
  ],
  ean: ['ean', 'codigodebarras', 'barras', 'gtin', 'codbarras', 'codigobarras'],
  saldo_inicial: [
    'saldo', 'saldoinicial', 'quantidade', 'qtd', 'qtde', 'estoque',
    'estoqueatual', 'contagem', 'saldoatual', 'inventario',
  ],
  custo_unitario: [
    'custo', 'custounitario', 'preco', 'precounitario', 'valor',
    'valorunitario', 'customedio', 'precocusto', 'vlunit',
  ],
}

/** Reduz um texto à forma comparável: sem acento, sem símbolo, minúsculo. */
export function chave(texto: unknown): string {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

/**
 * Casa cada campo do sistema com o índice da coluna na planilha.
 * Retorna -1 quando a coluna não foi encontrada.
 */
export function detectarColunas(cabecalho: unknown[]): Record<Campo, number> {
  const chaves = cabecalho.map(chave)
  const mapa = {} as Record<Campo, number>
  const usadas = new Set<number>()

  for (const campo of CAMPOS) {
    // Correspondência exata primeiro; só depois aceita "contém", que é mais
    // solto e poderia roubar a coluna de outro campo.
    let indice = chaves.findIndex(
      (c, i) => !usadas.has(i) && c !== '' && SINONIMOS[campo].includes(c),
    )

    if (indice === -1) {
      indice = chaves.findIndex(
        (c, i) =>
          !usadas.has(i) &&
          c !== '' &&
          SINONIMOS[campo].some((s) => s.length >= 4 && c.includes(s)),
      )
    }

    mapa[campo] = indice
    if (indice >= 0) usadas.add(indice)
  }

  return mapa
}

/**
 * Converte texto de planilha em número aceitando os dois formatos que
 * aparecem na prática: "1.234,56" (brasileiro) e "1234.56".
 */
export function paraNumero(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === '') return null
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null

  let texto = String(valor).trim()
  if (!texto) return null

  texto = texto.replace(/[R$\s]/gi, '')

  const temVirgula = texto.includes(',')
  const temPonto = texto.includes('.')

  if (temVirgula && temPonto) {
    // O último separador que aparece é o decimal.
    texto =
      texto.lastIndexOf(',') > texto.lastIndexOf('.')
        ? texto.replace(/\./g, '').replace(',', '.')
        : texto.replace(/,/g, '')
  } else if (temVirgula) {
    texto = texto.replace(',', '.')
  } else if (temPonto) {
    // Só ponto é ambíguo: "1.500" é mil e quinhentos numa planilha brasileira,
    // mas 1,5 se lido como decimal. Ler errado aqui envenena o CMV em silêncio.
    //
    // Critério: ponto único, exatamente 3 dígitos depois e parte inteira de 1 a
    // 3 dígitos sem zero à esquerda — o formato de milhar. Assim "1.500" vira
    // 1500, mas "0.500" continua 0,5 e "1234.567" continua decimal.
    const partes = texto.split('.')
    if (partes.length > 2) {
      texto = partes.join('')
    } else if (/^[1-9]\d{0,2}$/.test(partes[0]) && partes[1].length === 3) {
      texto = partes.join('')
    }
  }

  const numero = Number(texto)
  return Number.isFinite(numero) ? numero : null
}

const UNIDADES_CONHECIDAS: Record<string, string> = {
  un: 'un', und: 'un', unid: 'un', unidade: 'un', pc: 'un', peca: 'un', pç: 'un',
  kg: 'kg', quilo: 'kg', quilograma: 'kg', kgs: 'kg',
  g: 'g', grama: 'g', gr: 'g', gramas: 'g',
  l: 'L', lt: 'L', litro: 'L', litros: 'L', lts: 'L',
  ml: 'ml', mililitro: 'ml',
  cx: 'cx', caixa: 'cx',
  pct: 'pct', pacote: 'pct', pc7: 'pct',
  fd: 'fd', fardo: 'fd',
}

export function normalizarUnidade(valor: unknown): string {
  const c = chave(valor)
  if (!c) return 'un'
  return UNIDADES_CONHECIDAS[c] ?? String(valor).trim().slice(0, 12)
}

export type ProdutoImportado = {
  linha: number
  nome: string
  categoria: string | null
  unidade_medida: string
  estoque_minimo: number
  ean: string | null
  saldo_inicial: number
  custo_unitario: number
}

export type Problema = { linha: number; motivo: string }

export type Analise = {
  cabecalho: string[]
  mapa: Record<Campo, number>
  produtos: ProdutoImportado[]
  problemas: Problema[]
  temSaldo: boolean
}

function texto(valor: unknown): string {
  if (valor === null || valor === undefined) return ''
  return String(valor).trim()
}

/**
 * Aplica o mapa de colunas às linhas e devolve os produtos prontos, junto com
 * a lista do que foi descartado e por quê. Nada é escondido: se 12 linhas
 * caíram, as 12 aparecem na tela antes de qualquer gravação.
 */
export function normalizar(
  linhas: unknown[][],
  mapa: Record<Campo, number>,
): { produtos: ProdutoImportado[]; problemas: Problema[] } {
  const produtos: ProdutoImportado[] = []
  const problemas: Problema[] = []
  const vistos = new Map<string, number>()

  const pegar = (linha: unknown[], campo: Campo) => {
    const i = mapa[campo]
    return i >= 0 ? linha[i] : undefined
  }

  linhas.forEach((linha, indice) => {
    // +2: a planilha começa em 1 e a primeira linha é o cabeçalho.
    const numeroLinha = indice + 2

    const nome = texto(pegar(linha, 'nome'))
    if (!nome) {
      const vazia = linha.every((c) => texto(c) === '')
      if (!vazia) problemas.push({ linha: numeroLinha, motivo: 'Sem nome de produto.' })
      return
    }

    const chaveNome = chave(nome)
    const jaVisto = vistos.get(chaveNome)
    if (jaVisto) {
      problemas.push({
        linha: numeroLinha,
        motivo: `"${nome}" repetido (já apareceu na linha ${jaVisto}).`,
      })
      return
    }
    vistos.set(chaveNome, numeroLinha)

    const minimo = paraNumero(pegar(linha, 'estoque_minimo')) ?? 0
    const saldo = paraNumero(pegar(linha, 'saldo_inicial')) ?? 0
    const custo = paraNumero(pegar(linha, 'custo_unitario')) ?? 0

    if (minimo < 0 || saldo < 0 || custo < 0) {
      problemas.push({ linha: numeroLinha, motivo: `"${nome}" tem número negativo.` })
      return
    }

    produtos.push({
      linha: numeroLinha,
      nome: nome.slice(0, 200),
      categoria: texto(pegar(linha, 'categoria')) || null,
      unidade_medida: normalizarUnidade(pegar(linha, 'unidade_medida')),
      estoque_minimo: minimo,
      ean: texto(pegar(linha, 'ean')) || null,
      saldo_inicial: saldo,
      custo_unitario: custo,
    })
  })

  return { produtos, problemas }
}
