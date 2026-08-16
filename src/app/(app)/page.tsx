import Link from 'next/link'
import { carregarContexto, carregarSaldos, listarPracas } from '@/lib/dados'
import { moeda, quantidade } from '@/lib/formato'

export default async function Painel() {
  const contexto = await carregarContexto()
  if (!contexto) return null

  const [saldos, pracas] = await Promise.all([
    carregarSaldos(contexto.unidadeId),
    listarPracas(contexto.unidadeId),
  ])

  const comSaldo = saldos.filter((s) => s.total !== 0 || s.estoqueMinimo > 0)
  const abaixoMinimo = saldos.filter(
    (s) => s.estoqueMinimo > 0 && s.central < s.estoqueMinimo,
  )
  const valorCentral = saldos.reduce(
    (soma, s) => soma + s.central * s.custoMedio,
    0,
  )
  const valorPulmoes = saldos.reduce(
    (soma, s) =>
      soma +
      Object.values(s.pracas).reduce((sub, q) => sub + q, 0) * s.custoMedio,
    0,
  )

  if (saldos.length === 0) {
    return (
      <div className="cartao p-6">
        <h1 className="text-lg font-bold">Comece cadastrando</h1>
        <p className="mt-2 text-sm text-tinta-fraca">
          Ainda não há produtos nesta unidade. O caminho mais curto para o app
          funcionar hoje:
        </p>
        <ol className="mt-4 space-y-2 text-sm">
          <li>
            1. Cadastre as <Link href="/pracas" className="text-acento underline underline-offset-4">praças</Link>{' '}
            (Sushi, Cozinha, Bar…).
          </li>
          <li>
            2. Cadastre os <Link href="/produtos" className="text-acento underline underline-offset-4">produtos</Link>.
          </li>
          <li>
            3. Dê <Link href="/entrada" className="text-acento underline underline-offset-4">entrada</Link>{' '}
            no que já existe no estoque — é o saldo inicial.
          </li>
          <li>4. A partir daí, toda retirada passa pela tela de Saída.</li>
        </ol>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="cartao p-4">
          <p className="text-sm text-tinta-fraca">Valor no Estoque Central</p>
          <p className="mt-1 text-2xl font-bold">{moeda(valorCentral)}</p>
        </div>
        <div className="cartao p-4">
          <p className="text-sm text-tinta-fraca">Valor nos pulmões</p>
          <p className="mt-1 text-2xl font-bold">{moeda(valorPulmoes)}</p>
        </div>
        <div className="cartao p-4">
          <p className="text-sm text-tinta-fraca">Abaixo do mínimo</p>
          <p
            className={`mt-1 text-2xl font-bold ${
              abaixoMinimo.length ? 'text-alerta' : ''
            }`}
          >
            {abaixoMinimo.length}
          </p>
        </div>
      </section>

      {abaixoMinimo.length > 0 && (
        <section className="cartao overflow-hidden">
          <h2 className="border-b border-borda px-4 py-3 text-sm font-semibold text-alerta">
            Repor no Estoque Central
          </h2>
          <ul className="divide-y divide-borda">
            {abaixoMinimo.map((s) => (
              <li
                key={s.produtoId}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <span className="min-w-0 truncate">{s.nome}</span>
                <span className="shrink-0 text-sm">
                  <strong>{quantidade(s.central)}</strong>
                  <span className="text-tinta-fraca">
                    {' '}
                    / {quantidade(s.estoqueMinimo)} {s.unidadeMedida}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="cartao overflow-hidden">
        <h2 className="border-b border-borda px-4 py-3 text-sm font-semibold">
          Posição por produto
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="border-b border-borda text-left text-tinta-fraca">
                <th className="px-4 py-2 font-medium">Produto</th>
                <th className="px-4 py-2 text-right font-medium">Central</th>
                {pracas.map((p) => (
                  <th key={p.id} className="px-4 py-2 text-right font-medium">
                    {p.nome}
                  </th>
                ))}
                <th className="px-4 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borda">
              {comSaldo.map((s) => (
                <tr key={s.produtoId}>
                  <td className="px-4 py-2">
                    <span className="block">{s.nome}</span>
                    <span className="text-xs text-tinta-fraca">
                      {s.unidadeMedida}
                      {s.custoMedio > 0 && ` · ${moeda(s.custoMedio)}`}
                    </span>
                  </td>
                  <td
                    className={`px-4 py-2 text-right tabular-nums ${
                      s.estoqueMinimo > 0 && s.central < s.estoqueMinimo
                        ? 'font-semibold text-alerta'
                        : ''
                    }`}
                  >
                    {quantidade(s.central)}
                  </td>
                  {pracas.map((p) => (
                    <td
                      key={p.id}
                      className="px-4 py-2 text-right tabular-nums text-tinta-fraca"
                    >
                      {s.pracas[p.id] ? quantidade(s.pracas[p.id]) : '—'}
                    </td>
                  ))}
                  <td className="px-4 py-2 text-right font-medium tabular-nums">
                    {quantidade(s.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
