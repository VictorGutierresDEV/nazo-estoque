import Link from 'next/link'
import { carregarContexto, listarProdutos } from '@/lib/dados'
import { moeda, quantidade } from '@/lib/formato'
import { FormProduto } from './form'

export default async function Produtos() {
  const contexto = await carregarContexto()
  if (!contexto) return null

  const produtos = await listarProdutos(contexto.unidadeId)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Produtos</h1>
          <p className="mt-1 text-sm text-tinta-fraca">
            O custo médio é calculado sozinho a cada entrada. Não se digita aqui.
          </p>
        </div>
        {contexto.podeOperar && (
          <Link href="/produtos/importar" className="botao-neutro">
            Importar planilha
          </Link>
        )}
      </div>

      {contexto.podeOperar && <FormProduto />}

      <section className="cartao overflow-hidden">
        <h2 className="border-b border-borda px-4 py-3 text-sm font-semibold">
          Cadastrados ({produtos.length})
        </h2>
        {produtos.length === 0 ? (
          <p className="px-4 py-6 text-sm text-tinta-fraca">
            Nenhum produto ainda.
          </p>
        ) : (
          <ul className="divide-y divide-borda">
            {produtos.map((p) => (
              <li key={p.id} className="flex justify-between gap-3 px-4 py-3">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{p.nome}</span>
                  <span className="block truncate text-xs text-tinta-fraca">
                    {p.categoria ?? 'Sem categoria'} · {p.unidade_medida}
                    {Number(p.estoque_minimo) > 0 &&
                      ` · mínimo ${quantidade(Number(p.estoque_minimo))}`}
                  </span>
                </span>
                <span className="shrink-0 text-sm tabular-nums text-tinta-fraca">
                  {Number(p.custo_medio) > 0 ? moeda(Number(p.custo_medio)) : '—'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
