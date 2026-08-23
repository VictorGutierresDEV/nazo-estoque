import { redirect } from 'next/navigation'
import {
  carregarContexto,
  carregarSaldos,
  estadoDaImplantacao,
  listarItens,
  listarLocais,
  listarSetores,
  pode,
} from '@/lib/estoque'
import { FormImplantacao } from './form'

export default async function Implantacao() {
  const ctx = await carregarContexto()
  if (!ctx) return null
  if (!pode(ctx, 'saldo_inicial.lancar')) redirect('/')
  if (ctx.emProducao) redirect('/')

  const [itens, setores, locais, saldos, estado] = await Promise.all([
    listarItens(ctx.unidadeId),
    listarSetores(ctx.unidadeId),
    listarLocais(ctx.unidadeId),
    carregarSaldos(ctx.unidadeId),
    estadoDaImplantacao(ctx.unidadeId),
  ])

  const principal = locais.find((l) => l.tipo === 'PRINCIPAL')
  const pulmoes = locais.filter((l) => l.tipo === 'PULMAO')

  // Quantos itens já têm saldo em cada local — mostra o que falta percorrer.
  const progresso = [
    {
      id: null as string | null,
      nome: 'Estoque Principal',
      lancados: principal ? Object.keys(saldos[principal.id] ?? {}).length : 0,
    },
    ...setores.map((s) => {
      const local = pulmoes.find((p) => p.setor_id === s.id)
      return {
        id: s.id,
        nome: `Pulmão — ${s.nome}`,
        lancados: local ? Object.keys(saldos[local.id] ?? {}).length : 0,
      }
    }),
  ]

  const jaLancados: Record<string, Record<string, number>> = {}
  if (principal) jaLancados['__principal__'] = saldos[principal.id] ?? {}
  for (const s of setores) {
    const local = pulmoes.find((p) => p.setor_id === s.id)
    jaLancados[s.id] = local ? (saldos[local.id] ?? {}) : {}
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Inventário de implantação</h1>
        <p className="mt-1 text-sm text-tinta-fraca">
          A contagem física da virada. É a <strong>única</strong> origem de
          saldo que não vem de movimentação — depois que a unidade entrar em
          produção, esta tela desaparece e todo saldo passa a ser consequência
          dos fluxos.
        </p>
      </div>

      <section className="cartao overflow-hidden">
        <h2 className="border-b border-borda px-4 py-3 text-sm font-semibold">
          Onde já foi contado
        </h2>
        <ul className="divide-y divide-borda text-sm">
          {progresso.map((p) => (
            <li
              key={p.id ?? 'principal'}
              className="flex items-center justify-between gap-3 px-4 py-2.5"
            >
              <span>{p.nome}</span>
              <span
                className={
                  p.lancados > 0 ? 'text-positivo' : 'text-tinta-fraca'
                }
              >
                {p.lancados > 0 ? `${p.lancados} item(ns)` : 'não contado'}
              </span>
            </li>
          ))}
        </ul>
        <p className="border-t border-borda px-4 py-2 text-xs text-tinta-fraca">
          A praça fica fora do saldo nesta etapa, por decisão de projeto.
        </p>
      </section>

      <FormImplantacao
        itens={itens}
        setores={setores}
        jaLancados={jaLancados}
        totalLancado={estado.itensLancados}
      />
    </div>
  )
}
