import Link from 'next/link'
import { redirect } from 'next/navigation'
import { carregarContexto, cicloNoNazoGestao, listarSetores, pode } from '@/lib/estoque'
import { acessoDeLeitura, leituraRestrita } from '@/lib/acesso-leitura'
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

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/)
  return ((partes[0]?.[0] ?? '') + (partes.at(-1)?.[0] ?? '')).toUpperCase()
}

export default async function LayoutApp({ children }: LayoutProps<'/'>) {
  const ctx = await carregarContexto()
  if (!ctx) redirect('/login')

  const [acesso, cicloGestao] = await Promise.all([
    acessoDeLeitura(ctx.unidadeId),
    cicloNoNazoGestao(ctx.unidadeId),
  ])
  // Com a v57, a implantação é só da gestão (concessão direta não basta).
  const podeImplantar =
    !ctx.emProducao &&
    pode(ctx, 'saldo_inicial.lancar') &&
    !leituraRestrita(acesso)

  // Sem função no Estoque, mas com a v57 a pessoa pode ler setores pelo Nazo
  // Gestão (owner/manager ou responsável do setor): lê, só não registra. No
  // legado, como antes.
  const semFuncao = ctx.permissoes.size === 0
  const soLeitura =
    semFuncao &&
    acesso.modo === 'v57' &&
    (await listarSetores(ctx.unidadeId)).length > 0

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-borda bg-cartao/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2.5">
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-acento text-sm font-bold text-white">
              N
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold leading-tight">
                {ctx.unidadeNome}
              </span>
              <span className="block truncate text-xs text-tinta-fraca">
                {ctx.nome}
                {ctx.funcao && ` · ${ROTULO_FUNCAO[ctx.funcao] ?? ctx.funcao}`}
              </span>
            </span>
          </Link>

          <div className="flex shrink-0 items-center gap-2.5">
            {podeImplantar && (
              <Link
                href="/implantacao"
                className="rounded bg-alerta/15 px-2 py-1 text-[11px] font-bold text-alerta"
              >
                implantação
              </Link>
            )}
            <span className="flex size-9 items-center justify-center rounded-full border border-borda bg-papel text-xs font-semibold text-tinta-fraca">
              {iniciais(ctx.nome)}
            </span>
            <form action={sair}>
              <button
                type="submit"
                className="text-xs text-tinta-fraca underline underline-offset-4 hover:text-acento"
              >
                Sair
              </button>
            </form>
          </div>
        </div>

        <div className="hidden lg:block">
          <Navegacao permissoes={[...ctx.permissoes]} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5 pb-24 lg:pb-8">
        {cicloGestao && (
          <p role="status" className="mb-5 rounded-lg border border-acento/40 bg-acento-fraco px-4 py-3 text-sm">
            <strong>Pulmões no Nazo Gestão.</strong> Nesta unidade, a contagem e o abastecimento dos
            pulmões são feitos no Nazo Gestão, em Pulmões. O que for registrado aqui sobre contagem,
            requisição ou divergência é recusado.
          </p>
        )}
        {soLeitura ? (
          <p className="mb-5 rounded-lg border border-alerta/30 bg-alerta/10 px-4 py-3 text-sm">
            Você não tem função operacional no Estoque nesta unidade: consegue
            consultar os setores do seu acesso, mas não registra nada. Para
            registrar, peça à direção ou ao Gerente de CPD para atribuir sua
            função.
          </p>
        ) : (
          semFuncao && (
            <p className="mb-5 rounded-lg border border-alerta/30 bg-alerta/10 px-4 py-3 text-sm">
              Você não tem nenhuma função operacional atribuída nesta unidade,
              então não consegue ver nem registrar nada. Peça à direção ou ao
              Gerente de CPD para atribuir sua função.
            </p>
          )
        )}
        {children}
      </main>

      <div className="lg:hidden">
        <Navegacao permissoes={[...ctx.permissoes]} />
      </div>
    </div>
  )
}
