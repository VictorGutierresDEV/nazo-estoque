/**
 * Teste do perfil desativado no app (src/lib/perfil-desativado.ts).
 *
 *   node --experimental-strip-types scripts/teste-perfil-desativado.ts
 *
 * Quem recusa é o banco (v56 do Nazo Gestão) e o Auth (login banido). Aqui é
 * o app: reconhecer a recusa — inclusive quando o Auth não devolve usuário
 * nenhum para consultar o perfil —, e mandar à entrada com o motivo.
 */
import assert from 'node:assert/strict'
import {
  CODIGO_PERFIL_DESATIVADO,
  criarFetchVigiado,
  destinoDaSaida,
  ehRecusaDeDesativado,
  loginBanido,
  MENSAGEM_DESATIVADO,
  perfilDesativado,
} from '../src/lib/perfil-desativado.ts'

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

console.log('O login banido, sem usuário para consultar o perfil')
await teste('getUser() com o token de antes do banimento: 403 user_banned (a biblioteca põe o código em .code)', () => {
  assert.equal(loginBanido({ code: 'user_banned', message: 'User is banned' }), true)
})
await teste('a renovação recusada: "Invalid Refresh Token: User Banned", com ou sem o código', () => {
  assert.equal(loginBanido({ code: 'user_banned', message: 'Invalid Refresh Token: User Banned' }), true)
  assert.equal(loginBanido({ message: 'Invalid Refresh Token: User Banned' }), true)
})
await teste('sem sessão (visitante), senha errada, token vencido: não é desativado', () => {
  assert.equal(loginBanido({ message: 'Auth session missing!' }), false)
  assert.equal(loginBanido({ code: 'invalid_credentials', message: 'Invalid login credentials' }), false)
  assert.equal(loginBanido({ code: 'session_not_found', message: 'Session from session_id claim in JWT does not exist' }), false)
  assert.equal(loginBanido(null), false)
})

console.log('\nO perfil')
await teste('só profiles.ativo falso (sem banimento e sem a v56): desativado', () => {
  assert.equal(perfilDesativado({ ativo: false }, null), true)
})
await teste('a leitura do perfil recusada pela v56: desativado', () => {
  assert.equal(perfilDesativado(null, { code: CODIGO_PERFIL_DESATIVADO }), true)
})
await teste('perfil ativo, ou perfil que não veio por outro motivo: não', () => {
  assert.equal(perfilDesativado({ ativo: true }, null), false)
  assert.equal(perfilDesativado(null, { code: 'PGRST116', message: 'no rows' }), false)
})

console.log('\nPara onde vai quem sai')
await teste('de qualquer página: para a entrada, com o motivo', () => {
  assert.equal(destinoDaSaida(false, null), '/login?desativado=1')
})
await teste('da entrada sem o motivo: para a entrada com o motivo', () => {
  assert.equal(destinoDaSaida(true, null), '/login?desativado=1')
})
await teste('da entrada que já diz o motivo: fica (sem redirecionar em volta)', () => {
  assert.equal(destinoDaSaida(true, '1'), null)
})
await teste('a mensagem não fala em senha (não é para tentar de novo)', () => {
  assert.equal(MENSAGEM_DESATIVADO.includes('senha'), false)
})

console.log('\nAs respostas (o cliente do navegador)')
const resposta = (status: number, corpo: unknown, tipo = 'application/json') =>
  new Response(typeof corpo === 'string' ? corpo : JSON.stringify(corpo), { status, headers: { 'Content-Type': tipo } })
async function avisosDe(r: Response) {
  let avisos = 0
  const vigiado = criarFetchVigiado(async () => r, () => { avisos++ })
  const volta = await vigiado('https://x/qualquer')
  return { avisos, volta }
}
await teste('a recusa da v56 (403 PERFIL_DESATIVADO): avisa, e a resposta segue igual', async () => {
  const { avisos, volta } = await avisosDe(resposta(403, { code: CODIGO_PERFIL_DESATIVADO, message: MENSAGEM_DESATIVADO }))
  assert.equal(avisos, 1)
  assert.equal((await volta.json()).code, CODIGO_PERFIL_DESATIVADO)
})
await teste('a renovação recusada por login banido (400, code) e /user (403, error_code do corpo antigo): avisa', async () => {
  assert.equal((await avisosDe(resposta(400, { code: 'user_banned', message: 'Invalid Refresh Token: User Banned' }))).avisos, 1)
  assert.equal((await avisosDe(resposta(403, { code: 403, error_code: 'user_banned', msg: 'User is banned' }))).avisos, 1)
})
await teste('senha errada, permissão comum, corpo que não é JSON, resposta normal: não avisa', async () => {
  assert.equal((await avisosDe(resposta(400, { code: 'invalid_credentials', message: 'Invalid login credentials' }))).avisos, 0)
  assert.equal((await avisosDe(resposta(403, { code: '42501', message: 'permission denied' }))).avisos, 0)
  assert.equal((await avisosDe(resposta(403, '<html>proibido</html>', 'text/html'))).avisos, 0)
  assert.equal((await avisosDe(resposta(200, [{ id: 1 }]))).avisos, 0)
})
await teste('o código com status que não é de recusa: não', () => {
  assert.equal(ehRecusaDeDesativado(200, { code: 'user_banned' }), false)
  assert.equal(ehRecusaDeDesativado(500, { code: CODIGO_PERFIL_DESATIVADO }), false)
})

console.log(falhas === 0 ? '\nTudo certo.' : `\n${falhas} falha(s).`)
process.exit(falhas === 0 ? 0 : 1)
