import Link from 'next/link'
import {
  CICLO_HOJE,
  carregarContexto,
  carregarSaldos,
  contagemDoCiclo,
  divergenciasPendentes,
  estadoDaImplantacao,
  listarItens,
  listarLocais,
  listarSetores,
  minimosDaCasa,
  pode,
  rodadaDoCiclo,
} from '@/lib/estoque'
import { quantidade as fmt } from '@/lib/formato'

const SITUACAO: Record<string, string> = {
  SUGERIDA: 'sugestão pronta',
  SEPARADA: 'aguardando o líder',
  RECEBIDA: 'concluída',
}

export default async function Painel() {
  const ctx = await carregarContexto()
  if (!ctx) return null

  const ciclo = CICLO_HOJE()
  const [setores, itens, locais, saldos, pendentes, minCasa, implantacao] =
    await Promise.all([
      listarSetores(ctx.unidadeId),
      listarItens(ctx.unidadeId),
      listarLocais(ctx.unidadeId),
      carregarSaldos(ctx.unidadeId),
      divergenciasPendentes(ctx.unidadeId),
      minimosDaCasa(ctx.unidadeId),
      estadoDaImplantacao(ctx.unidadeId),
    ])

  // Estado do ciclo de hoje, setor por setor.
  const estados = await Promise.all(
    setores.map(async (s) => {
      const [c, r] = await Promise.all([
        contagemDoCiclo(ctx.unidadeId, s.id, ciclo),
        rodadaDoCiclo(ctx.unidadeId, s.id, ciclo),
      ])
      return {
        setor: s,
        contagem: c.contagem?.situacao ?? null,
        rodada: r.rodada?.situacao ?? null,
      }
    }),
  )

  const principal = locais.find((l) => l.tipo === 'PRINCIPAL')
  const noPrincipal = principal ? (saldos[principal.id] ?? {}) : {}
  const emTransito = locais
    .filter((l) => l.tipo === 'TRANSITO')
    .flatMap((l) => Object.values(saldos[l.id] ?? {}))
    .reduce((a, b) => a + b, 0)

  const abaixoDoMinimoDaCasa = itens.filter((i) => {
    const min = minCasa[i.id]
    if (!min) return false
    const total = Object.values(locais)
      .map((l) => saldos[l.id]?.[i.id] ?? 0)
      .reduce((a, b) => a + b, 0)
    return total < min
  })

  if (implantacao.itensLancados === 0) {
    return (
      <div className="cartao p-6">
        <h1 className="text-lg font-bold">Estoque ainda não implantado</h1>
        <p className="mt-2 text-sm text-tinta-fraca">
          Nenhum saldo inicial lançado. O sistema começa pela contagem física da
          virada — Estoque Principal e pulmões dos setores.
        </p>
        {pode(ctx, 'saldo_inicial.lancar') ? (
          <Link href="/implantacao" className="botao mt-4">
            Ir para o inventário de implantação
          </Link>
        ) : (
          <p className="mt-4 text-sm text-alerta">
            Quem lança o inventário de implantação é a direção, o Gerente de CPD
            ou o estoquista.
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="cartao p-4">
          <p className="text-sm text-tinta-fraca">Itens no Estoque Principal</p>
          <p className="mt-1 text-2xl font-bold">
            {Object.values(noPrincipal).filter((q) => q > 0).length}
          </p>
        </div>
        <div className="cartao p-4">
          <p className="text-sm text-tinta-fraca">Divergências pendentes</p>
          <p
            className={`mt-1 text-2xl font-bold ${
              pendentes.length ? 'text-alerta' : ''
            }`}
          >
            {pendentes.length}
          </p>
        </div>
        <div className="cartao p-4">
          <p className="text-sm text-tinta-fraca">Em trânsito agora</p>
          <p className={`mt-1 text-2xl font-bold ${emTransito ? 'text-alerta' : ''}`}>
            {fmt(emTransito)}
          </p>
        </div>
      </section>

      <section className="cartao overflow-hidden">
        <h2 className="border-b border-borda px-4 py-3 text-sm font-semibold">
          Ciclo de hoje ({ciclo})
        </h2>
        <ul className="divide-y divide-borda">
          {estados.map((e) => (
            <li
              key={e.setor.id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
            >
              <span className="font-medium">{e.setor.nome}</span>
              <span className="flex flex-wrap items-center gap-2 text-xs">
                <span
                  className={`rounded px-2 py-0.5 font-semibold ${
                    e.contagem === 'FINALIZADA'
                      ? 'bg-positivo/15 text-positivo'
                      : e.contagem
                        ? 'bg-alerta/15 text-alerta'
                        : 'bg-borda text-tinta-fraca'
                  }`}
                >
                  {e.contagem === 'FINALIZADA'
                    ? 'contado'
                    : e.contagem
                      ? 'contagem aberta'
                      : 'sem contagem'}
                </span>
                {e.rodada && (
                  <span className="rounded bg-acento-fraco px-2 py-0.5 font-semibold text-acento">
                    {SITUACAO[e.rodada] ?? e.rodada}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-3 border-t border-borda px-4 py-3">
          <Link href="/contagem" className="botao-neutro">
            Contar pulmão
          </Link>
          <Link href="/abastecimento" className="botao-neutro">
            Abastecimento
          </Link>
        </div>
      </section>

      {abaixoDoMinimoDaCasa.length > 0 && (
        <section className="cartao overflow-hidden">
          <h2 className="border-b border-borda px-4 py-3 text-sm font-semibold text-alerta">
            Abaixo do mínimo da casa ({abaixoDoMinimoDaCasa.length})
          </h2>
          <p className="border-b border-borda px-4 py-2 text-xs text-tinta-fraca">
            Soma de todas as camadas com saldo. Serve à decisão de pedido, não ao
            abastecimento do pulmão.
          </p>
          <ul className="max-h-72 divide-y divide-borda overflow-auto text-sm">
            {abaixoDoMinimoDaCasa.map((i) => {
              const total = locais
                .map((l) => saldos[l.id]?.[i.id] ?? 0)
                .reduce((a, b) => a + b, 0)
              return (
                <li key={i.id} className="flex justify-between gap-3 px-4 py-2">
                  <span className="min-w-0 truncate">
                    {i.nome}
                    {i.critico && (
                      <span className="ml-2 rounded bg-acento-fraco px-1.5 py-0.5 text-[10px] font-semibold text-acento">
                        crítico
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    <strong>{fmt(total)}</strong>
                    <span className="text-tinta-fraca">
                      {' '}/ {fmt(minCasa[i.id])} {i.unidade_contagem}
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
