'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * As abas seguem as PERMISSÕES, não o cargo. Quem não tem a permissão não vê
 * a aba — e, mesmo que digite a URL, o banco recusa a operação.
 */
const ABAS = [
  { href: '/', rotulo: 'Painel', permissao: 'estoque.ver' },
  { href: '/contagem', rotulo: 'Contagem', permissao: 'pulmao.contar' },
  { href: '/abastecimento', rotulo: 'Abastecimento', permissao: 'estoque.ver' },
  { href: '/divergencias', rotulo: 'Divergências', permissao: 'estoque.ver' },
  { href: '/minimos', rotulo: 'Mínimos', permissao: 'estoque.ver' },
  { href: '/itens', rotulo: 'Itens', permissao: 'estoque.ver' },
  { href: '/extrato', rotulo: 'Extrato', permissao: 'estoque.ver' },
] as const

export function Navegacao({
  permissoes,
  emProducao,
}: {
  permissoes: string[]
  emProducao: boolean
}) {
  const caminho = usePathname()
  const tem = (p: string) => permissoes.includes(p)

  const abas = [
    // A implantação só aparece enquanto a unidade não virou a chave.
    ...(!emProducao && tem('saldo_inicial.lancar')
      ? [{ href: '/implantacao', rotulo: 'Implantação', permissao: 'saldo_inicial.lancar' }]
      : []),
    ...ABAS.filter((a) => tem(a.permissao)),
  ]

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
