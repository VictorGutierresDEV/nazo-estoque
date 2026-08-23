import {
  carregarContexto,
  carregarExtrato,
  carregarTrilha,
  listarItens,
  listarLocais,
  nomesDePessoas,
} from '@/lib/estoque'
import { dataHora, quantidade as fmt } from '@/lib/formato'

const FLUXO: Record<string, string> = {
  SALDO_INICIAL: 'Saldo inicial — principal',
  SALDO_INICIAL_PULMAO: 'Saldo inicial — pulmão',
  ABASTECIMENTO_SEPARACAO: 'Separação',
  ABASTECIMENTO_RECEBIMENTO: 'Recebimento no pulmão',
  APURACAO_CORRECAO_REGISTRO: 'Correção de registro',
  APURACAO_RECEBIMENTO_COMPLEMENTAR: 'Recebimento complementar',
  APURACAO_PERDA_TRANSITO: 'Perda em trânsito',
  FECHAMENTO_PULMAO_SOND: 'Saída operacional não discriminada',
}

const EVENTO: Record<string, string> = {
  CONTAGEM_ABERTA: 'Contagem aberta',
  CONTAGEM_FINALIZADA: 'Contagem finalizada',
  RODADA_GERADA: 'Sugestão gerada',
  SEPARACAO_AJUSTADA: 'Separação ajustada',
  SEPARACAO_CONFIRMADA: 'Separação confirmada',
  RECEBIMENTO_CONFIRMADO: 'Recebimento confirmado',
  DIVERGENCIA_APURADA: 'Divergência apurada',
  PARAMETRO_ALTERADO: 'Parâmetro alterado',
  PARAMETRO_SUGERIDO: 'Alteração sugerida',
  INVENTARIO_IMPLANTACAO: 'Inventário de implantação',
  UNIDADE_EM_PRODUCAO: 'Unidade em produção',
}

export default async function Extrato() {
  const ctx = await carregarContexto()
  if (!ctx) return null

  const [movimentos, trilha, itens, locais] = await Promise.all([
    carregarExtrato(ctx.unidadeId, 150),
    carregarTrilha(ctx.unidadeId, 150),
    listarItens(ctx.unidadeId),
    listarLocais(ctx.unidadeId),
  ])

  const pessoas = await nomesDePessoas([
    ...movimentos.map((m) => m.registrado_por),
    ...trilha.map((t) => t.ator),
  ])

  const nomeItem = new Map(itens.map((i) => [i.id, i.nome]))
  const nomeLocal = new Map(locais.map((l) => [l.id, l.nome]))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Extrato</h1>
        <p className="mt-1 text-sm text-tinta-fraca">
          Duas coisas separadas de propósito: o <strong>razão</strong> só tem o
          que alterou saldo; a <strong>trilha</strong> tem tudo que aconteceu,
          inclusive o que nunca tocou saldo.
        </p>
      </div>

      <section className="cartao overflow-hidden">
        <h2 className="border-b border-borda px-4 py-3 text-sm font-semibold">
          Razão de movimentações ({movimentos.length})
        </h2>
        {movimentos.length === 0 ? (
          <p className="px-4 py-6 text-sm text-tinta-fraca">
            Nenhum movimento ainda.
          </p>
        ) : (
          <div className="max-h-[32rem] overflow-auto">
            <table className="w-full min-w-[44rem] text-sm">
              <thead className="sticky top-0 bg-cartao">
                <tr className="border-b border-borda text-left text-tinta-fraca">
                  <th className="px-4 py-2 font-medium">Quando</th>
                  <th className="px-3 py-2 font-medium">Fluxo</th>
                  <th className="px-3 py-2 font-medium">Item</th>
                  <th className="px-3 py-2 text-right font-medium">Qtd</th>
                  <th className="px-3 py-2 font-medium">De → Para</th>
                  <th className="px-3 py-2 font-medium">Por</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borda">
                {movimentos.map((m) => (
                  <tr key={m.id}>
                    <td className="whitespace-nowrap px-4 py-2 text-tinta-fraca">
                      {dataHora(m.momento)}
                    </td>
                    <td className="px-3 py-2">
                      {FLUXO[m.fluxo] ?? m.fluxo}
                      {m.estorno_de && (
                        <span className="ml-1.5 rounded bg-alerta/15 px-1.5 py-0.5 text-[10px] font-semibold text-alerta">
                          estorno
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {nomeItem.get(m.item_id) ?? m.item_id}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {fmt(Number(m.quantidade))}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-tinta-fraca">
                      {m.local_origem_id
                        ? (nomeLocal.get(m.local_origem_id) ?? '—')
                        : 'fora'}
                      {' → '}
                      {m.local_destino_id
                        ? (nomeLocal.get(m.local_destino_id) ?? '—')
                        : 'fora'}
                    </td>
                    <td className="px-3 py-2 text-xs text-tinta-fraca">
                      {pessoas[m.registrado_por] ?? '—'}
                      {m.funcao_exercida && (
                        <span className="block">{m.funcao_exercida}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="cartao overflow-hidden">
        <h2 className="border-b border-borda px-4 py-3 text-sm font-semibold">
          Trilha de auditoria ({trilha.length})
        </h2>
        {trilha.length === 0 ? (
          <p className="px-4 py-6 text-sm text-tinta-fraca">
            Nenhum evento ainda.
          </p>
        ) : (
          <ul className="max-h-[32rem] divide-y divide-borda overflow-auto text-sm">
            {trilha.map((t) => (
              <li key={t.id} className="px-4 py-2.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">
                    {EVENTO[t.tipo] ?? t.tipo}
                  </span>
                  <span className="text-xs text-tinta-fraca">
                    {dataHora(t.momento)} · {pessoas[t.ator ?? ''] ?? '—'}
                    {t.funcao_exercida && ` · ${t.funcao_exercida}`}
                  </span>
                </div>
                {t.observacao && (
                  <p className="mt-0.5 text-xs text-tinta-fraca">
                    {t.observacao}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
