'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/database.types'
import { criarFetchVigiado, DESTINO_DESATIVADO } from '@/lib/perfil-desativado'

// Perfil desativado com a página já aberta: a chamada recusada (a v56 do
// banco, ou a renovação do token recusada pelo Auth por login banido) tira da
// sessão e leva à entrada com o motivo, sem esperar a próxima navegação — que
// já não teria o motivo, porque a biblioteca apaga a sessão recusada.
let saindo = false
function sairPorDesativado() {
  if (saindo || typeof window === 'undefined') return
  saindo = true
  const cliente = criarClienteNavegador()
  cliente.auth.signOut({ scope: 'local' }).finally(() => window.location.replace(DESTINO_DESATIVADO))
}

export function criarClienteNavegador() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { fetch: criarFetchVigiado((...args) => fetch(...args), sairPorDesativado) } },
  )
}
