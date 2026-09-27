// Perfil desativado no Nazo Gestão (docs/perfil-desativado.md de lá).
//
// Quem recusa é o banco (a v56 do Nazo Gestão devolve 403 com o código
// PERFIL_DESATIVADO) e o Auth (a manage-member bane o login de quem é
// desativado). Este arquivo só deixa o app reagir direito: reconhecer a
// recusa, sair da sessão e dizer por quê na entrada. Sem o Next nem o
// navegador, para ser testado fora deles (scripts/teste-perfil-desativado.ts).

export const MENSAGEM_DESATIVADO = 'Seu acesso ao Nazo foi desativado. Fale com a gestão da sua unidade.'
export const CODIGO_PERFIL_DESATIVADO = 'PERFIL_DESATIVADO'
// A entrada lê este parâmetro para dizer por que a sessão acabou.
export const DESTINO_DESATIVADO = '/login?desativado=1'

type ComCodigo = { code?: string | number | null; message?: string | null } | null | undefined
type CorpoDoErro = { code?: unknown; error_code?: unknown } | null | undefined

// O erro do Auth quer dizer que o login foi banido (perfil desativado)? O Auth
// recusa com `user_banned`: no login e na renovação da sessão (400), e, com o
// token ainda válido, em /user e /logout (403). Nesse caminho, `getUser()` não
// devolve usuário nenhum para consultar o perfil. "User is banned" e
// "Invalid Refresh Token: User Banned" cobrem as versões que não mandam o
// código.
export function loginBanido(erro: ComCodigo): boolean {
  if (!erro) return false
  return erro.code === 'user_banned' || /user (is )?banned/i.test(erro.message ?? '')
}

// O perfil lido diz desativado (sem a v56), ou o banco recusou a leitura dele
// (com a v56)?
export function perfilDesativado(perfil: { ativo?: boolean | null } | null | undefined, erro: ComCodigo): boolean {
  return perfil?.ativo === false || erro?.code === CODIGO_PERFIL_DESATIVADO
}

// Uma resposta HTTP (da API de dados ou do Auth) que diz que o acesso foi
// desativado. O corpo novo do Auth traz o código em `code`; o antigo, em
// `error_code`.
export function ehRecusaDeDesativado(status: number, corpo: CorpoDoErro): boolean {
  if (status === 403 && corpo?.code === CODIGO_PERFIL_DESATIVADO) return true
  return (status === 400 || status === 403) && (corpo?.code === 'user_banned' || corpo?.error_code === 'user_banned')
}

// Para onde vai quem saiu por perfil desativado: a entrada, com o motivo. Na
// entrada que já diz o motivo, fica (sem redirecionar de novo).
export function destinoDaSaida(ehLogin: boolean, parametroDesativado: string | null): string | null {
  if (ehLogin && parametroDesativado === '1') return null
  return DESTINO_DESATIVADO
}

// Um fetch que olha as respostas 400 e 403: se for a recusa de perfil
// desativado ou de login banido, avisa (uma vez por resposta) e devolve a
// resposta como veio — quem chamou continua recebendo o erro.
export function criarFetchVigiado(
  fetchBase: typeof fetch,
  aoDesativar: () => void,
): typeof fetch {
  return async (...args) => {
    const resposta = await fetchBase(...args)
    if (resposta.status === 400 || resposta.status === 403) {
      try {
        const corpo = await resposta.clone().json()
        if (ehRecusaDeDesativado(resposta.status, corpo)) aoDesativar()
      } catch {
        // corpo que não é JSON: não é a recusa
      }
    }
    return resposta
  }
}
