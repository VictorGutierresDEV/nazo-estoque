'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

/**
 * A navegação deixou de ser a superfície principal.
 *
 * Quem abre o app cai na fila de tarefas, não numa lista de módulos — então
 * aqui ficam só os quatro destinos que correspondem a fazer alguma coisa.
 * Itens, Mínimos, Extrato e Implantação são consulta e preparo: vivem como
 * atalho no painel, fora do caminho.
 *
 * No celular isto é barra inferior, na zona do polegar. No desktop, faixa
 * abaixo do cabeçalho.
 */
const ABAS = [
  { href: '/', rotulo: 'Painel', permissao: 'estoque.ver', icone: <IconePainel /> },
  { href: '/contagem', rotulo: 'Contar', permissao: 'pulmao.contar', icone: <IconeContar /> },
  {
    href: '/abastecimento',
    rotulo: 'Abastecer',
    permissao: 'estoque.ver',
    icone: <IconeAbastecer />,
  },
  {
    href: '/divergencias',
    rotulo: 'Divergências',
    permissao: 'estoque.ver',
    icone: <IconeDivergencia />,
  },
] as const

export function Navegacao({ permissoes }: { permissoes: string[] }) {
  const caminho = usePathname()
  const abas = ABAS.filter((a) => permissoes.includes(a.permissao))
  if (!abas.length) return null

  const ativa = (href: string) =>
    href === '/' ? caminho === '/' : caminho.startsWith(href)

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-borda bg-cartao pb-[env(safe-area-inset-bottom)]
                 lg:static lg:border-t-0 lg:bg-transparent lg:pb-0"
      aria-label="Navegação principal"
    >
      <ul className="mx-auto flex max-w-5xl lg:gap-1 lg:px-2">
        {abas.map((aba) => {
          const atual = ativa(aba.href)
          return (
            <li key={aba.href} className="flex-1 lg:flex-none">
              <Link
                href={aba.href}
                aria-current={atual ? 'page' : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium transition
                            lg:min-h-0 lg:flex-row lg:gap-2 lg:border-b-2 lg:px-3 lg:py-2.5 lg:text-sm ${
                              atual
                                ? 'text-acento lg:border-acento'
                                : 'text-tinta-fraca hover:text-tinta lg:border-transparent'
                            }`}
              >
                <span className="lg:hidden">{aba.icone}</span>
                <span className="whitespace-nowrap">{aba.rotulo}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

function Traco({ children }: { children: ReactNode }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

function IconePainel() {
  return (
    <Traco>
      <path d="M4 6h7M4 12h7M4 18h7M15 6h5M15 12h5M15 18h5" />
    </Traco>
  )
}

function IconeContar() {
  return (
    <Traco>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h5M8 16h3" />
    </Traco>
  )
}

function IconeAbastecer() {
  return (
    <Traco>
      <path d="M3 8l9-4 9 4v8l-9 4-9-4V8z" />
      <path d="M3 8l9 4 9-4M12 12v8" />
    </Traco>
  )
}

function IconeDivergencia() {
  return (
    <Traco>
      <path d="M12 3l9 16H3l9-16z" />
      <path d="M12 9v4M12 16v.01" />
    </Traco>
  )
}
