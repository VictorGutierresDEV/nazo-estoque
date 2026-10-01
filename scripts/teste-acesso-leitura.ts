/**
 * Teste da leitura por unidade em foco e setor (src/lib/acesso-leitura-nucleo.ts).
 *
 *   node --experimental-strip-types scripts/teste-acesso-leitura.ts
 *
 * O app é publicado antes da v57: sem ela o PostgREST responde PGRST202 e o
 * app segue no modo legado, como antes. Com ela, a resposta decide o que a
 * pessoa lê. Qualquer outro erro é lançado — nunca vira vazio, zero ou falso.
 * Aqui o cliente é falso: nada toca banco nem rede.
 */
import assert from 'node:assert/strict'
import {
  ErroDeLeitura,
  escolherSetor,
  FUNCAO_AUSENTE,
  leituraRestrita,
  lerAcesso,
  lerItensComSaldoNoPulmao,
  lerUnidadeImplantada,
  semErro,
  type ClienteRpc,
  type RespostaRpc,
} from '../src/lib/acesso-leitura-nucleo.ts'

let falhas = 0
async function teste(nome: string, fn: () => void | Promise<void>) {
  try {
    await fn()
    console.log('  ok   ' + nome)
  } catch (e) {
    falhas++
    console.log('  FALHOU  ' + nome + ': ' + (e as Error).message)
  }
}

type Chamada = { nome: string; args: Record<string, unknown> }

function clienteFalso(resposta: RespostaRpc): ClienteRpc & { chamadas: Chamada[] } {
  const chamadas: Chamada[] = []
  return {
    chamadas,
    rpc(nome, args) {
      chamadas.push({ nome, args })
      return Promise.resolve(resposta)
    },
  }
}

const ausente: RespostaRpc = {
  data: null,
  error: {
    code: FUNCAO_AUSENTE,
    message: 'Could not find the function public.estoque_d4_gestao(p_unidade_id) in the schema cache',
  },
}
const outroErro: RespostaRpc = {
  data: null,
  error: { code: '42501', message: 'permission denied for function estoque_d4_gestao' },
}
const UNI = '11111111-1111-1111-1111-111111111111'
const SETOR = '22222222-2222-2222-2222-222222222222'
const ITEM_A = '33333333-3333-3333-3333-333333333333'
const ITEM_B = '44444444-4444-4444-4444-444444444444'

console.log('estoque_d4_gestao (o acesso de leitura)')
await teste('v57, gestão: { modo: v57, gestao: true }, com o id da unidade em foco', async () => {
  const c = clienteFalso({ data: true, error: null })
  assert.deepEqual(await lerAcesso(c, UNI), { modo: 'v57', gestao: true })
  assert.deepEqual(c.chamadas, [{ nome: 'estoque_d4_gestao', args: { p_unidade_id: UNI } }])
})
await teste('v57, fora da gestão: { modo: v57, gestao: false } e leitura restrita', async () => {
  const acesso = await lerAcesso(clienteFalso({ data: false, error: null }), UNI)
  assert.deepEqual(acesso, { modo: 'v57', gestao: false })
  assert.equal(leituraRestrita(acesso), true)
})
await teste('sem a v57 (PGRST202): modo legado, gestao: true, leitura não restrita', async () => {
  const acesso = await lerAcesso(clienteFalso(ausente), UNI)
  assert.deepEqual(acesso, { modo: 'legado', gestao: true })
  assert.equal(leituraRestrita(acesso), false)
})
await teste('outro erro: lança (não vira legado nem "sem gestão")', async () => {
  await assert.rejects(lerAcesso(clienteFalso(outroErro), UNI), (e: unknown) => {
    assert.ok(e instanceof ErroDeLeitura)
    assert.equal(e.codigo, '42501')
    return true
  })
})
await teste('resposta que não é booleana: lança', async () => {
  await assert.rejects(lerAcesso(clienteFalso({ data: null, error: null }), UNI), ErroDeLeitura)
  await assert.rejects(lerAcesso(clienteFalso({ data: 'true', error: null }), UNI), ErroDeLeitura)
})

console.log('\nestoque_d4_unidade_implantada')
await teste('dado: devolve o sim ou o não do banco', async () => {
  const c = clienteFalso({ data: true, error: null })
  assert.equal(await lerUnidadeImplantada(c, UNI), true)
  assert.deepEqual(c.chamadas, [
    { nome: 'estoque_d4_unidade_implantada', args: { p_unidade_id: UNI } },
  ])
  assert.equal(await lerUnidadeImplantada(clienteFalso({ data: false, error: null }), UNI), false)
})
await teste('PGRST202: null (quem chamou volta a contar os movimentos)', async () => {
  assert.equal(await lerUnidadeImplantada(clienteFalso(ausente), UNI), null)
})
await teste('outro erro: lança (não vira "não implantado")', async () => {
  await assert.rejects(lerUnidadeImplantada(clienteFalso(outroErro), UNI), ErroDeLeitura)
})

console.log('\nestoque_d4_itens_com_saldo_pulmao')
await teste('dado: a lista de ids, com o id do setor', async () => {
  const c = clienteFalso({ data: [ITEM_A, ITEM_B], error: null })
  assert.deepEqual(await lerItensComSaldoNoPulmao(c, SETOR), [ITEM_A, ITEM_B])
  assert.deepEqual(c.chamadas, [
    { nome: 'estoque_d4_itens_com_saldo_pulmao', args: { p_setor_id: SETOR } },
  ])
})
await teste('dado na forma de objeto por linha também serve', async () => {
  const c = clienteFalso({
    data: [{ estoque_d4_itens_com_saldo_pulmao: ITEM_A }],
    error: null,
  })
  assert.deepEqual(await lerItensComSaldoNoPulmao(c, SETOR), [ITEM_A])
})
await teste('lista vazia (setor sem saldo ou fora do acesso): vazia', async () => {
  assert.deepEqual(await lerItensComSaldoNoPulmao(clienteFalso({ data: [], error: null }), SETOR), [])
})
await teste('PGRST202: null (quem chamou volta à visão de saldos)', async () => {
  assert.equal(await lerItensComSaldoNoPulmao(clienteFalso(ausente), SETOR), null)
})
await teste('outro erro ou resposta estranha: lança (não vira fila sem saldo)', async () => {
  await assert.rejects(lerItensComSaldoNoPulmao(clienteFalso(outroErro), SETOR), ErroDeLeitura)
  await assert.rejects(
    lerItensComSaldoNoPulmao(clienteFalso({ data: [{ quantidade: 3 }], error: null }), SETOR),
    ErroDeLeitura,
  )
  await assert.rejects(
    lerItensComSaldoNoPulmao(clienteFalso({ data: 'x', error: null }), SETOR),
    ErroDeLeitura,
  )
})

console.log('\nLeitura comum e escolha do setor')
await teste('semErro: lança com erro, passa sem', () => {
  assert.throws(() => semErro('os setores', { code: '500', message: 'caiu' }), /os setores: caiu \(500\)/)
  semErro('os setores', null)
})
const setores = [{ id: 'a' }, { id: 'b' }]
const v57 = { modo: 'v57', gestao: false } as const
const legado = { modo: 'legado', gestao: true } as const
await teste('setor pedido e visível: é ele, sem aviso', () => {
  assert.deepEqual(escolherSetor(setores, 'b', v57), { setorId: 'b', foraDoAcesso: false })
})
await teste('v57, setor fora da lista: primeiro visível, com aviso', () => {
  assert.deepEqual(escolherSetor(setores, 'z', v57), { setorId: 'a', foraDoAcesso: true })
})
await teste('legado, setor fora da lista: primeiro, sem aviso (como antes)', () => {
  assert.deepEqual(escolherSetor(setores, 'z', legado), { setorId: 'a', foraDoAcesso: false })
})
await teste('sem setor pedido ou sem setor visível: sem aviso', () => {
  assert.deepEqual(escolherSetor(setores, undefined, v57), { setorId: 'a', foraDoAcesso: false })
  assert.deepEqual(escolherSetor([], undefined, v57), { setorId: '', foraDoAcesso: false })
})

console.log(falhas === 0 ? '\nTudo certo.' : `\n${falhas} falha(s).`)
process.exit(falhas === 0 ? 0 : 1)
