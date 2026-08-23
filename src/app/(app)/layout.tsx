import Link from 'next/link'
import { redirect } from 'next/navigation'
import { carregarContexto } from '@/lib/estoque'
import { sair } from '@/lib/operacoes'
import { Navegacao } from './navegacao'

const ROTULO_FUNCAO: Record<string, string> = {
  DIRECAO: 'Direção',
  GERENTE_CPD: 'Gerente de CPD',
  GERENTE_BACK: 'Gerente de Back',
  ESTOQUISTA: 'Estoquista',
  LIDER_SETOR: 'Líder de setor',
  SUBCHEFE: 'Subchefe',
  AUXILIAR: 'Auxiliar',
  ESTAGIARIO_NUTRICAO: 'Estagiário de nutrição',
}

export default async function LayoutApp({ children }: LayoutProps<'/'>) {
  const ctx = await carregarContexto()
  if (!ctx) redirect('/login')

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-borda bg-cartao/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="min-w-0">
            <span className="block truncate text-base font-bold leading-tight">
              Nazo Estoque
            </span>
            <span className="block truncate text-xs text-tinta-fraca">
              {ctx.unidadeNome} · {ctx.nome}
              {ctx.funcao && ` · ${ROTULO_FUNCAO[ctx.funcao] ?? ctx.funcao}`}
            </span>
          </Link>

          <div className="flex shrink-0 items-center gap-3">
            {!ctx.emProducao && (
              <span
                className="rounded bg-alerta/15 px-2 py-1 text-xs font-semibold text-alerta"
                title="A unidade ainda aceita inventário de implantação"
              >
                implantação
              </span>
            )}
            <form action={sair}>
              <button
                type="submit"
                className="text-sm text-tinta-fraca underline underline-offset-4 hover:text-acento"
              >
                Sair
              </button>
            </form>
          </div>
        </div>

        <Navegacao permissoes={[...ctx.permissoes]} emProducao={ctx.emProducao} />
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {ctx.permissoes.size === 0 && (
          <p className="mb-6 rounded-lg border border-alerta/30 bg-alerta/10 px-4 py-3 text-sm">
            Você não tem nenhuma função operacional atribuída nesta unidade,
            então não consegue ver nem registrar nada. Peça à direção ou ao
            Gerente de CPD para atribuir sua função.
          </p>
        )}
        {children}
      </main>
    </div>
  )
}
