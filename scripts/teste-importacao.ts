/**
 * Teste do leitor de planilha. Roda com:
 *   node --experimental-strip-types scripts/teste-importacao.ts
 *
 * Usa um cabeçalho propositalmente "sujo" — do jeito que planilha de
 * restaurante chega: acento, abreviação, maiúscula, ordem trocada.
 */
import assert from 'node:assert/strict'
import {
  chave,
  detectarColunas,
  normalizar,
  normalizarUnidade,
  paraNumero,
} from '../src/lib/importacao.ts'

let falhas = 0
function teste(nome: string, fn: () => void) {
  try {
    fn()
    console.log(`  ok   ${nome}`)
  } catch (e) {
    falhas++
    console.log(`  FALHA ${nome}\n        ${(e as Error).message}`)
  }
}

console.log('\nnúmeros no formato brasileiro')
teste('1.234,56 vira 1234.56', () => assert.equal(paraNumero('1.234,56'), 1234.56))
teste('12,5 vira 12.5', () => assert.equal(paraNumero('12,5'), 12.5))
teste('1234.56 continua 1234.56', () => assert.equal(paraNumero('1234.56'), 1234.56))
teste('R$ 89,90 vira 89.9', () => assert.equal(paraNumero('R$ 89,90'), 89.9))
teste('1.500 (milhar) vira 1500', () => assert.equal(paraNumero('1.500'), 1500))
teste('12.500 (milhar) vira 12500', () => assert.equal(paraNumero('12.500'), 12500))
teste('1.234.567 vira 1234567', () => assert.equal(paraNumero('1.234.567'), 1234567))
teste('0.500 continua decimal 0.5', () => assert.equal(paraNumero('0.500'), 0.5))
teste('1234.567 continua decimal', () => assert.equal(paraNumero('1234.567'), 1234.567))
teste('2.5 continua decimal', () => assert.equal(paraNumero('2.5'), 2.5))
teste('89.90 continua decimal', () => assert.equal(paraNumero('89.90'), 89.9))
teste('vazio vira null', () => assert.equal(paraNumero(''), null))
teste('texto vira null', () => assert.equal(paraNumero('a definir'), null))
teste('número puro passa', () => assert.equal(paraNumero(42), 42))

console.log('\nunidades')
teste('KG vira kg', () => assert.equal(normalizarUnidade('KG'), 'kg'))
teste('Quilo vira kg', () => assert.equal(normalizarUnidade('Quilo'), 'kg'))
teste('Litro vira L', () => assert.equal(normalizarUnidade('Litro'), 'L'))
teste('vazio vira un', () => assert.equal(normalizarUnidade(''), 'un'))
teste('desconhecida é preservada', () => assert.equal(normalizarUnidade('bandeja'), 'bandeja'))

console.log('\nnormalização de texto')
teste('acento e caixa somem', () => assert.equal(chave('Descrição do Produto'), 'descricaodoproduto'))

console.log('\ndetecção de colunas em cabeçalho sujo')
const cabecalho = [
  'Cód. Barras',
  'DESCRIÇÃO DO PRODUTO',
  'Grupo',
  'Un. Medida',
  'Estoque Mínimo',
  'Saldo Atual',
  'Custo Unitário',
]
const mapa = detectarColunas(cabecalho)
teste('nome achou "DESCRIÇÃO DO PRODUTO"', () => assert.equal(mapa.nome, 1))
teste('categoria achou "Grupo"', () => assert.equal(mapa.categoria, 2))
teste('unidade achou "Un. Medida"', () => assert.equal(mapa.unidade_medida, 3))
teste('mínimo achou "Estoque Mínimo"', () => assert.equal(mapa.estoque_minimo, 4))
teste('saldo achou "Saldo Atual"', () => assert.equal(mapa.saldo_inicial, 5))
teste('custo achou "Custo Unitário"', () => assert.equal(mapa.custo_unitario, 6))
teste('ean achou "Cód. Barras"', () => assert.equal(mapa.ean, 0))
teste('nenhuma coluna foi usada duas vezes', () => {
  const usados = Object.values(mapa).filter((i) => i >= 0)
  assert.equal(new Set(usados).size, usados.length)
})

console.log('\nnormalização das linhas')
const linhas = [
  ['789123', 'Salmão fresco', 'Pescados', 'KG', '5', '12,5', 'R$ 89,90'],
  ['', 'Arroz para sushi', 'Secos', 'kg', '10', '1.500', '7,20'],
  ['', '', '', '', '', '', ''],                       // linha em branco: ignorada em silêncio
  ['', 'Salmão fresco', 'Pescados', 'KG', '5', '3', '90'],  // duplicada
  ['', '', 'Bebidas', 'un', '2', '4', '5'],           // sem nome
  ['', 'Shoyu', 'Molhos', 'L', '-3', '2', '18'],      // negativo
]
const { produtos, problemas } = normalizar(linhas, mapa)

teste('2 produtos válidos', () => assert.equal(produtos.length, 2))
teste('3 problemas relatados', () => assert.equal(problemas.length, 3))
teste('linha em branco não vira problema', () =>
  assert.ok(!problemas.some((p) => p.linha === 4)))
teste('duplicada acusada na linha 5', () =>
  assert.ok(problemas.some((p) => p.linha === 5 && p.motivo.includes('repetido'))))
teste('sem nome acusado na linha 6', () =>
  assert.ok(problemas.some((p) => p.linha === 6 && p.motivo.includes('Sem nome'))))
teste('negativo acusado na linha 7', () =>
  assert.ok(problemas.some((p) => p.linha === 7 && p.motivo.includes('negativo'))))

const salmao = produtos[0]
teste('salmão: unidade normalizada', () => assert.equal(salmao.unidade_medida, 'kg'))
teste('salmão: saldo 12,5 lido', () => assert.equal(salmao.saldo_inicial, 12.5))
teste('salmão: custo R$ 89,90 lido', () => assert.equal(salmao.custo_unitario, 89.9))
teste('salmão: ean preservado', () => assert.equal(salmao.ean, '789123'))
teste('arroz: 1.500 lido como 1500', () => assert.equal(produtos[1].saldo_inicial, 1500))

console.log('\ncabeçalho alternativo (outro modelo possível)')
const mapa2 = detectarColunas(['Item', 'Categoria', 'UN', 'Qtd', 'Preço'])
teste('nome achou "Item"', () => assert.equal(mapa2.nome, 0))
teste('saldo achou "Qtd"', () => assert.equal(mapa2.saldo_inicial, 3))
teste('custo achou "Preço"', () => assert.equal(mapa2.custo_unitario, 4))
teste('sem coluna de mínimo vira -1', () => assert.equal(mapa2.estoque_minimo, -1))

console.log(falhas === 0 ? '\nTODOS OS TESTES PASSARAM\n' : `\n${falhas} FALHA(S)\n`)
process.exit(falhas === 0 ? 0 : 1)
