'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ABAS = [
  { href: '/', rotulo: 'Painel', operador: false },
  { href: '/saida', rotulo: 'Saída', operador: true },
  { href: '/entrada', rotulo: 'Entrada', operador: true },
  { href: '/extrato', rotulo: 'Extrato', operador: false },
  { href: '/produtos', rotulo: 'Produtos', operador: false },
  { href: '/pracas', rotulo: 'Praças', operador: false },
] as const

export function Navegacao({ podeOperar }: { podeOperar: boolean }) {
  const caminho = usePathname()
  const abas = ABAS.filter((aba) => podeOperar || !aba.operador)

  return (
    <nav className="mx-auto max-w-5xl overflow-x-auto px-2">
      <ul className="flex gap-1">
        {abas.map((aba) => {
          const ativa =
            aba.href === '/' ? caminho === '/' : caminho.startsWith(aba.href)
          return (
            <li key={aba.href}>
              <Link
                href={aba.href}
                aria-current={ativa ? 'page' : undefined}
                className={`block whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition ${
                  ativa
                    ? 'border-acento text-acento'
                    : 'border-transparent text-tinta-fraca hover:text-tinta'
                }`}
              >
                {aba.rotulo}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
