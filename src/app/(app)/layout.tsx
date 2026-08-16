import Link from 'next/link'
import { redirect } from 'next/navigation'
import { carregarContexto } from '@/lib/dados'
import { sair } from '@/lib/acoes'
import { Navegacao } from './navegacao'

export default async function LayoutApp({ children }: LayoutProps<'/'>) {
  const contexto = await carregarContexto()

  // Sem perfil não há unidade, e sem unidade nenhuma tela faz sentido.
  if (!contexto) redirect('/login')

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-borda bg-cartao/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="min-w-0">
            <span className="block truncate text-base font-bold leading-tight">
              Nazo Estoque
            </span>
            <span className="block truncate text-xs text-tinta-fraca">
              {contexto.unidadeNome} · {contexto.nome}
            </span>
          </Link>

          <form action={sair}>
            <button
              type="submit"
              className="shrink-0 text-sm text-tinta-fraca underline underline-offset-4 hover:text-acento"
            >
              Sair
            </button>
          </form>
        </div>

        <Navegacao podeOperar={contexto.podeOperar} />
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {!contexto.podeOperar && (
          <p className="mb-6 rounded-lg border border-alerta/30 bg-alerta/10 px-4 py-3 text-sm">
            Seu perfil <strong>{contexto.papel || 'sem papel'}</strong> só
            consulta. Para registrar entrada ou saída, peça ao gestor para
            ajustar seu acesso no app do Nazo.
          </p>
        )}
        {children}
      </main>
    </div>
  )
}
