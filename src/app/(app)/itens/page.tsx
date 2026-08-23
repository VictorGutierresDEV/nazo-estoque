import Link from 'next/link'
import { carregarContexto, listarItens, pode } from '@/lib/estoque'

export default async function Itens() {
  const ctx = await carregarContexto()
  if (!ctx) return null

  const itens = await listarItens(ctx.unidadeId)
  const semOrientacao = itens.filter((i) => !i.orientacao_contagem).length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Itens</h1>
          <p className="mt-1 text-sm text-tinta-fraca">
            Só catálogo. Saldo não se digita aqui — vem do inventário de
            implantação e depois só de movimentação.
          </p>
        </div>
        {pode(ctx, 'cadastro.gerenciar') && (
          <Link href="/itens/importar" className="botao-neutro">
            Importar planilha
          </Link>
        )}
      </div>

      {semOrientacao > 0 && (
        <p className="rounded-lg border border-alerta/30 bg-alerta/10 px-4 py-3 text-sm">
          {semOrientacao} de {itens.length} itens estão sem{' '}
          <strong>orientação de contagem</strong>. O Contexto Mestre (§11) aponta
          o erro de unidade como falha recorrente — contar pacote onde o processo
          espera caixa. Preencher esse texto é o que reduz o erro de quem é novo
          na liderança.
        </p>
      )}

      <section className="cartao overflow-hidden">
        <h2 className="border-b border-borda px-4 py-3 text-sm font-semibold">
          Cadastrados ({itens.length})
        </h2>
        {itens.length === 0 ? (
          <p className="px-4 py-6 text-sm text-tinta-fraca">
            Nenhum item ainda.
          </p>
        ) : (
          <ul className="max-h-[36rem] divide-y divide-borda overflow-auto">
            {itens.map((i) => (
              <li key={i.id} className="px-4 py-3">
                <span className="block truncate font-medium">
                  {i.nome}
                  {i.critico && (
                    <span className="ml-2 rounded bg-acento-fraco px-1.5 py-0.5 text-[10px] font-semibold text-acento">
                      crítico
                    </span>
                  )}
                </span>
                <span className="block truncate text-xs text-tinta-fraca">
                  {i.categoria ?? 'sem categoria'} · {i.unidade_contagem}
                  {i.orientacao_contagem
                    ? ` · ${i.orientacao_contagem}`
                    : ' · sem orientação de contagem'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
