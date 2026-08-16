'use client'

import Link from 'next/link'
import { useActionState, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  analisarPlanilha,
  importarProdutos,
  type RespostaImportacao,
} from '@/lib/acoes-importacao'
import {
  CAMPOS,
  CAMPO_OBRIGATORIO,
  ROTULO_CAMPO,
  normalizar,
  type Campo,
} from '@/lib/importacao'
import { moeda, quantidade } from '@/lib/formato'

export function Importador() {
  const router = useRouter()
  const [analise, analisar, analisando] = useActionState(analisarPlanilha, null)

  // O vínculo detectado é só um palpite. Fica em estado para o operador poder
  // corrigir antes de gravar — planilha de restaurante quase nunca vem com o
  // cabeçalho que o sistema espera.
  const [ajustes, setAjustes] = useState<Partial<Record<Campo, number>>>({})
  const [comSaldo, setComSaldo] = useState(true)
  const [resultado, setResultado] = useState<RespostaImportacao | null>(null)
  const [gravando, iniciarGravacao] = useTransition()

  const mapa = useMemo(() => {
    if (!analise?.ok) return null
    return { ...analise.mapa, ...ajustes } as Record<Campo, number>
  }, [analise, ajustes])

  const revisao = useMemo(() => {
    if (!analise?.ok || !mapa) return null
    return normalizar(analise.linhas, mapa)
  }, [analise, mapa])

  const temColunaSaldo = mapa ? mapa.saldo_inicial >= 0 : false
  const totalComSaldo =
    revisao?.produtos.filter((p) => p.saldo_inicial > 0).length ?? 0

  function gravar() {
    if (!revisao?.produtos.length) return
    iniciarGravacao(async () => {
      const r = await importarProdutos(
        revisao.produtos,
        comSaldo && temColunaSaldo,
      )
      setResultado(r)
      if (r.ok) router.refresh()
    })
  }

  if (resultado?.ok) {
    return (
      <div className="cartao space-y-4 p-6">
        <h2 className="text-lg font-bold text-positivo">Importação concluída</h2>
        <ul className="space-y-1 text-sm">
          <li>{resultado.criados} produto(s) criado(s)</li>
          <li>{resultado.atualizados} produto(s) atualizado(s)</li>
          {resultado.comSaldo > 0 && (
            <li>{resultado.comSaldo} com saldo inicial lançado</li>
          )}
          {resultado.pulados > 0 && (
            <li className="text-alerta">
              {resultado.pulados} tiveram o saldo ignorado por já ter
              movimento registrado — reimportar não dobra estoque.
            </li>
          )}
        </ul>
        <div className="flex flex-wrap gap-3">
          <Link href="/produtos" className="botao">
            Ver produtos
          </Link>
          <Link href="/" className="botao-neutro">
            Ir para o painel
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <form action={analisar} className="cartao space-y-4 p-4">
        <div>
          <label className="rotulo" htmlFor="arquivo">
            Planilha de produtos (.xlsx ou .csv)
          </label>
          <input
            id="arquivo"
            name="arquivo"
            type="file"
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            required
            className="campo py-2.5 file:mr-3 file:rounded file:border-0 file:bg-acento-fraco file:px-3 file:py-1.5 file:text-sm file:text-acento"
          />
          <p className="mt-2 text-xs text-tinta-fraca">
            O modelo é seu: a primeira linha deve ser o cabeçalho, e as colunas
            são reconhecidas pelo nome. Depois de ler, você confere e corrige o
            vínculo antes de gravar.
          </p>
        </div>

        <button type="submit" className="botao" disabled={analisando}>
          {analisando ? 'Lendo planilha…' : 'Ler planilha'}
        </button>
      </form>

      {analise && !analise.ok && (
        <p className="rounded-lg border border-acento/30 bg-acento-fraco px-4 py-3 text-sm text-acento">
          {analise.erro}
        </p>
      )}

      {analise?.ok && mapa && revisao && (
        <>
          <section className="cartao p-4">
            <h2 className="mb-1 text-sm font-semibold">
              Vínculo das colunas
            </h2>
            <p className="mb-4 text-xs text-tinta-fraca">
              Aba “{analise.aba}” · {analise.linhas.length} linha(s).
              Confira antes de gravar.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              {CAMPOS.map((campo) => {
                const faltando =
                  CAMPO_OBRIGATORIO.includes(campo) && mapa[campo] < 0
                return (
                  <div key={campo}>
                    <label className="rotulo" htmlFor={`col-${campo}`}>
                      {ROTULO_CAMPO[campo]}
                      {CAMPO_OBRIGATORIO.includes(campo) && ' *'}
                    </label>
                    <select
                      id={`col-${campo}`}
                      className={`campo ${faltando ? 'border-acento' : ''}`}
                      value={mapa[campo]}
                      onChange={(e) =>
                        setAjustes((a) => ({
                          ...a,
                          [campo]: Number(e.target.value),
                        }))
                      }
                    >
                      <option value={-1}>— não importar —</option>
                      {analise.cabecalho.map((titulo, i) => (
                        <option key={i} value={i}>
                          {titulo || `Coluna ${i + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="cartao overflow-hidden">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-borda px-4 py-3">
              <h2 className="text-sm font-semibold">
                Prévia — {revisao.produtos.length} produto(s)
              </h2>
              {revisao.problemas.length > 0 && (
                <span className="text-xs text-alerta">
                  {revisao.problemas.length} linha(s) fora
                </span>
              )}
            </div>

            <div className="max-h-96 overflow-auto">
              <table className="w-full min-w-[34rem] text-sm">
                <thead className="sticky top-0 bg-cartao">
                  <tr className="border-b border-borda text-left text-tinta-fraca">
                    <th className="px-4 py-2 font-medium">Produto</th>
                    <th className="px-4 py-2 font-medium">Categoria</th>
                    <th className="px-4 py-2 font-medium">Un</th>
                    <th className="px-4 py-2 text-right font-medium">Mínimo</th>
                    <th className="px-4 py-2 text-right font-medium">Saldo</th>
                    <th className="px-4 py-2 text-right font-medium">Custo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borda">
                  {revisao.produtos.slice(0, 200).map((p) => (
                    <tr key={p.linha}>
                      <td className="px-4 py-2">{p.nome}</td>
                      <td className="px-4 py-2 text-tinta-fraca">
                        {p.categoria ?? '—'}
                      </td>
                      <td className="px-4 py-2 text-tinta-fraca">
                        {p.unidade_medida}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {quantidade(p.estoque_minimo)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {p.saldo_inicial ? quantidade(p.saldo_inicial) : '—'}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {p.custo_unitario ? moeda(p.custo_unitario) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {revisao.produtos.length > 200 && (
              <p className="border-t border-borda px-4 py-2 text-xs text-tinta-fraca">
                Mostrando as 200 primeiras. As {revisao.produtos.length} serão
                gravadas.
              </p>
            )}
          </section>

          {revisao.problemas.length > 0 && (
            <section className="cartao overflow-hidden">
              <h2 className="border-b border-borda px-4 py-3 text-sm font-semibold text-alerta">
                Linhas que não serão importadas
              </h2>
              <ul className="max-h-56 divide-y divide-borda overflow-auto text-sm">
                {revisao.problemas.map((p, i) => (
                  <li key={i} className="px-4 py-2">
                    <span className="text-tinta-fraca">Linha {p.linha}:</span>{' '}
                    {p.motivo}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {temColunaSaldo && totalComSaldo > 0 && (
            <label className="cartao flex cursor-pointer items-start gap-3 p-4">
              <input
                type="checkbox"
                checked={comSaldo}
                onChange={(e) => setComSaldo(e.target.checked)}
                className="mt-1 size-5 accent-[var(--acento)]"
              />
              <span className="text-sm">
                <strong>Lançar o saldo inicial como entrada</strong>
                <span className="mt-1 block text-tinta-fraca">
                  {totalComSaldo} produto(s) têm saldo na planilha. Isso cria uma
                  entrada de abertura no Estoque Central e define o custo médio.
                  Produto que já tem movimento é ignorado, então reimportar não
                  dobra o estoque.
                </span>
              </span>
            </label>
          )}

          {resultado && !resultado.ok && (
            <p className="rounded-lg border border-acento/30 bg-acento-fraco px-4 py-3 text-sm text-acento">
              {resultado.erro}
            </p>
          )}

          <button
            type="button"
            onClick={gravar}
            className="botao w-full"
            disabled={gravando || revisao.produtos.length === 0}
          >
            {gravando
              ? 'Gravando…'
              : `Importar ${revisao.produtos.length} produto(s)`}
          </button>
        </>
      )}
    </div>
  )
}
