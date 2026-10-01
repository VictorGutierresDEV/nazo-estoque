import { cache } from 'react'
import { criarClienteServidor } from '@/lib/supabase/server'
import {
  lerAcesso,
  lerItensComSaldoNoPulmao,
  lerUnidadeImplantada,
  type AcessoLeitura,
  type ClienteRpc,
} from '@/lib/acesso-leitura-nucleo'

export {
  leituraRestrita,
  escolherSetor,
  MENSAGEM_RESERVADO,
  MENSAGEM_SEM_SETOR_VISIVEL,
  MENSAGEM_SETOR_FORA_DO_ACESSO,
  type AcessoLeitura,
} from '@/lib/acesso-leitura-nucleo'

/**
 * O acesso de leitura da pessoa na unidade em foco (v57 ou legado).
 *
 * Memoizado por requisição com `cache` do React: layout, página e as funções
 * de leitura perguntam à vontade e o banco responde uma vez por render. Nada
 * aqui sobrevive à requisição — o cliente carrega a sessão daquela pessoa.
 */
export const acessoDeLeitura = cache(
  async (unidadeId: string): Promise<AcessoLeitura> =>
    lerAcesso(await clienteRpc(), unidadeId),
)

/** Há saldo inicial lançado? `null` = modo legado (conte os movimentos). */
export const unidadeImplantada = cache(
  async (unidadeId: string): Promise<boolean | null> =>
    lerUnidadeImplantada(await clienteRpc(), unidadeId),
)

/** Itens com saldo no pulmão do setor, sem quantidade. `null` = modo legado. */
export const itensComSaldoNoPulmao = cache(
  async (setorId: string): Promise<string[] | null> =>
    lerItensComSaldoNoPulmao(await clienteRpc(), setorId),
)

async function clienteRpc(): Promise<ClienteRpc> {
  const supabase = await criarClienteServidor()
  // O nome da função chega como texto; os tipos de cada uma estão em
  // database.types.ts e a resposta é conferida no núcleo.
  return { rpc: supabase.rpc.bind(supabase) as unknown as ClienteRpc['rpc'] }
}
