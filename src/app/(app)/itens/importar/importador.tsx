'use client'

import Link from 'next/link'
import { useActionState, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  analisarPlanilha,
  importarItens,
  type RespostaImportacao,
} from '@/lib/acoes-importacao'
import {
  CAMPOS,
  CAMPO_OBRIGATORIO,
  ROTULO_CAMPO,
  normalizar,
  type Campo,
} from '@/lib/importacao'

/** Campos que o catálogo usa. Saldo e custo são lidos e descartados. */
const CAMPOS_DO_CATALOGO: Campo[] = [
  'nome',
  'categoria',
  'unidade_medida',
  'ean',
]

export function Importador() {
  const router = useRouter()
  const [analise, analisar, analisando] = useActionState(analisarPlanilha, null)
  const [ajustes, setAjustes] = useState<Partial<Record<Campo, number>>>({})
  const [resultado, setResultado] = useState<RespostaImportacao | null>(null)
  const [gravando, iniciar] = useTransition()

  const mapa = useMemo(() => {
    if (!analise?.ok) return null
    return { ...analise.mapa, ...ajustes } as Record<Campo, number>
  }, [analise, ajustes])

  const revisao = useMemo(() => {
    if (!analise?.ok || !mapa) return null
    return normalizar(analise.linhas, mapa)
  }, [analise, mapa])

  if (resultado?.ok) {
    return (
      <div className="cartao space-y-4 p-6">
        <h2 className="text-lg font-bold text-positivo">Catálogo atualizado</h2>
        <ul className="space-y-1 text-sm">
          <li>{resultado.criados} item(ns) criado(s)</li>
          <li>{resultado.atualizados} item(ns) atualizado(s)</li>
        </ul>
        <p className="text-sm text-tinta-fraca">
          Nenhum saldo foi criado. Para o estoque nascer, use o inventário de
          implantação.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/itens" className="botao">
            Ver itens
          </Link>
          <Link href="/implantacao" className="botao-neutro">
            Inventário de implantação
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
            Planilha (.xlsx ou .csv)
          </label>
          <input
            id="arquivo"
            name="arquivo"
            type="file"
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            required
            className="campo py-2.5 file:mr-3 file:rounded file:border-0 file:bg-acento-fraco file:px-3 file:py-1.5 file:text-sm file:text-acento"
          />
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
            <h2 className="mb-1 text-sm font-semibold">Vínculo das colunas</h2>
            <p className="mb-4 text-xs text-tinta-fraca">
              Aba “{analise.aba}” · {analise.linhas.length} linha(s).
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {CAMPOS.filter((c) => CAMPOS_DO_CATALOGO.includes(c)).map((campo) => (
                <div key={campo}>
                  <label className="rotulo" htmlFor={`col-${campo}`}>
                    {ROTULO_CAMPO[campo]}
                    {CAMPO_OBRIGATORIO.includes(campo) && ' *'}
                  </label>
                  <select
                    id={`col-${campo}`}
                    className={`campo ${
                      CAMPO_OBRIGATORIO.includes(campo) && mapa[campo] < 0
                        ? 'border-acento'
                        : ''
                    }`}
                    value={mapa[campo]}
                    onChange={(e) =>
                      setAjustes((a) => ({ ...a, [campo]: Number(e.target.value) }))
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
              ))}
            </div>
          </section>

          <section className="cartao overflow-hidden">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-borda px-4 py-3">
              <h2 className="text-sm font-semibold">
                Prévia — {revisao.produtos.length} item(ns)
              </h2>
              {revisao.problemas.length > 0 && (
                <span className="text-xs text-alerta">
                  {revisao.problemas.length} linha(s) fora
                </span>
              )}
            </div>
            <div className="max-h-96 overflow-auto">
              <table className="w-full min-w-[28rem] text-sm">
                <thead className="sticky top-0 bg-cartao">
                  <tr className="border-b border-borda text-left text-tinta-fraca">
                    <th className="px-4 py-2 font-medium">Item</th>
                    <th className="px-4 py-2 font-medium">Categoria</th>
                    <th className="px-4 py-2 font-medium">Unidade</th>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {revisao.problemas.length > 0 && (
            <section className="cartao overflow-hidden">
              <h2 className="border-b border-borda px-4 py-3 text-sm font-semibold text-alerta">
                Linhas que não serão importadas
              </h2>
              <ul className="max-h-56 divide-y divide-borda overflow-auto text-sm">
                {revisao.problemas.map((pr, i) => (
                  <li key={i} className="px-4 py-2">
                    <span className="text-tinta-fraca">Linha {pr.linha}:</span>{' '}
                    {pr.motivo}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {resultado && !resultado.ok && (
            <p className="rounded-lg border border-acento/30 bg-acento-fraco px-4 py-3 text-sm text-acento">
              {resultado.erro}
            </p>
          )}

          <button
            type="button"
            className="botao w-full"
            disabled={gravando || revisao.produtos.length === 0}
            onClick={() =>
              iniciar(async () => {
                const r = await importarItens(revisao.produtos)
                setResultado(r)
                if (r.ok) router.refresh()
              })
            }
          >
            {gravando
              ? 'Gravando…'
              : `Importar ${revisao.produtos.length} item(ns)`}
          </button>
        </>
      )}
    </div>
  )
}
