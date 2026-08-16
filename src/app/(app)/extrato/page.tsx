import { carregarContexto, carregarExtrato } from '@/lib/dados'
import { dataHora, moeda, quantidade } from '@/lib/formato'

const ROTULO: Record<string, string> = {
  ENTRADA: 'Entrada',
  SAIDA: 'Saída',
  DEVOLUCAO: 'Devolução',
  PERDA: 'Perda',
  AJUSTE: 'Ajuste',
  TRANSFERENCIA: 'Transferência',
}

type Linha = Awaited<ReturnType<typeof carregarExtrato>>[number]

export default async function Extrato() {
  const contexto = await carregarContexto()
  if (!contexto) return null

  const linhas = await carregarExtrato(contexto.unidadeId, 300)

  // A view devolve uma linha por perna do razão. Na tela, o operador pensa
  // em "movimento", então agrupamos de volta pelo documento — e ficamos só
  // com a perna que sai do Central, senão cada saída apareceria duplicada.
  const porTransacao = new Map<string, { cabecalho: Linha; itens: Linha[] }>()
  for (const l of linhas) {
    const chave = l.transacao_id!
    if (!porTransacao.has(chave))
      porTransacao.set(chave, { cabecalho: l, itens: [] })
    const grupo = porTransacao.get(chave)!
    const ehPernaDuplicada = l.tipo === 'SAIDA' && l.entrada === true
    if (!ehPernaDuplicada) grupo.itens.push(l)
  }

  const movimentos = [...porTransacao.values()].filter((m) => m.itens.length)

  if (movimentos.length === 0) {
    return (
      <div className="cartao p-6">
        <h1 className="text-lg font-bold">Nenhum movimento ainda</h1>
        <p className="mt-2 text-sm text-tinta-fraca">
          Assim que a primeira entrada ou saída for registrada, ela aparece
          aqui — com data, produto, quantidade, praça e nome de quem retirou.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Extrato</h1>
        <p className="mt-1 text-sm text-tinta-fraca">
          Últimos {movimentos.length} movimentos. Nada aqui pode ser apagado ou
          editado — correção entra como estorno.
        </p>
      </div>

      <ul className="space-y-3">
        {movimentos.map(({ cabecalho, itens }) => {
          const total = itens.reduce((s, i) => s + Number(i.valor ?? 0), 0)
          const estorno = cabecalho.estorno_de != null

          return (
            <li key={cabecalho.transacao_id} className="cartao p-4">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-semibold ${
                      cabecalho.tipo === 'SAIDA'
                        ? 'bg-acento-fraco text-acento'
                        : 'bg-positivo/10 text-positivo'
                    }`}
                  >
                    {ROTULO[cabecalho.tipo!] ?? cabecalho.tipo}
                  </span>
                  {estorno && (
                    <span className="rounded bg-alerta/15 px-2 py-0.5 text-xs font-semibold text-alerta">
                      Estorno
                    </span>
                  )}
                  {cabecalho.praca_nome && (
                    <span className="text-sm font-medium">
                      → {cabecalho.praca_nome}
                    </span>
                  )}
                </div>
                <span className="text-sm text-tinta-fraca">
                  {dataHora(cabecalho.ocorrido_em)}
                </span>
              </div>

              <ul className="mb-3 space-y-1 text-sm">
                {itens.map((i) => (
                  <li key={i.produto_id} className="flex justify-between gap-3">
                    <span className="min-w-0 truncate">{i.produto_nome}</span>
                    <span className="shrink-0 tabular-nums text-tinta-fraca">
                      {quantidade(Number(i.quantidade ?? 0))} {i.unidade_medida}
                      {Number(i.valor ?? 0) > 0 &&
                        ` · ${moeda(Number(i.valor))}`}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-t border-borda pt-2 text-xs text-tinta-fraca">
                <span>
                  {cabecalho.retirado_por_nome && (
                    <>
                      Retirado por{' '}
                      <strong className="text-tinta">
                        {cabecalho.retirado_por_nome}
                      </strong>
                      {' · '}
                    </>
                  )}
                  {cabecalho.fornecedor && <>Origem {cabecalho.fornecedor} · </>}
                  Registrado por {cabecalho.registrado_por_nome ?? '—'}
                </span>
                {total > 0 && (
                  <span className="font-medium text-tinta">{moeda(total)}</span>
                )}
              </div>

              {(cabecalho.observacao || cabecalho.motivo) && (
                <p className="mt-2 text-xs text-tinta-fraca">
                  {cabecalho.motivo ?? cabecalho.observacao}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
