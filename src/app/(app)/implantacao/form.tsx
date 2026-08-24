'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  concluirInventarioLocal,
  lancarInventarioImplantacao,
  marcarEmProducao,
} from '@/lib/operacoes'
import { dataHora, quantidade as fmt } from '@/lib/formato'
import type { Item, Setor } from '@/lib/estoque'

type LinhaChecklist = {
  localId: string
  setorId: string | null
  nome: string
  itensLancados: number
  concluidoEm: string | null
  concluidoPor: string | null
}

type Props = {
  itens: Item[]
  setores: Setor[]
  jaLancados: Record<string, Record<string, number>>
  checklist: LinhaChecklist[]
}

const PRINCIPAL = '__principal__'

export function FormImplantacao({
  itens,
  setores,
  jaLancados,
  checklist,
}: Props) {
  const router = useRouter()
  const [alvo, setAlvo] = useState<string>(PRINCIPAL)
  const [busca, setBusca] = useState('')
  const [valores, setValores] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
  const [ocupado, iniciar] = useTransition()

  const chaveDoAlvo = alvo
  const lancadosNoAlvo = jaLancados[chaveDoAlvo] ?? {}
  const linhaAlvo = checklist.find((c) =>
    alvo === PRINCIPAL ? c.setorId === null : c.setorId === alvo,
  )
  const alvoConcluido = !!linhaAlvo?.concluidoEm

  const pendentes = checklist.filter((c) => !c.concluidoEm)
  const tudoConcluido = pendentes.length === 0

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return itens.filter((i) => !termo || i.nome.toLowerCase().includes(termo))
  }, [itens, busca])

  const preenchidos = Object.entries(valores).filter(
    ([, v]) => v.trim() !== '' && Number(v.replace(',', '.')) > 0,
  )

  function agir(
    fn: () => Promise<{ ok: boolean; erro?: string }>,
    sucesso: string,
    limpar = false,
  ) {
    iniciar(async () => {
      const r = await fn()
      if (r.ok) {
        setMsg({ ok: true, texto: sucesso })
        if (limpar) setValores({})
        router.refresh()
      } else {
        setMsg({ ok: false, texto: r.erro ?? 'Falhou.' })
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* ---------------- checklist ---------------- */}
      <section className="cartao overflow-hidden">
        <h2 className="border-b border-borda px-4 py-3 text-sm font-semibold">
          Locais a concluir ({checklist.length - pendentes.length}/
          {checklist.length})
        </h2>
        <ul className="divide-y divide-borda text-sm">
          {checklist.map((c) => (
            <li
              key={c.localId || c.nome}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
            >
              <span className="flex items-center gap-2">
                <span
                  aria-hidden
                  className={`inline-flex size-5 items-center justify-center rounded-full text-xs font-bold ${
                    c.concluidoEm
                      ? 'bg-positivo/20 text-positivo'
                      : 'bg-borda text-tinta-fraca'
                  }`}
                >
                  {c.concluidoEm ? '✓' : '·'}
                </span>
                <span className={c.concluidoEm ? '' : 'font-medium'}>
                  {c.nome}
                </span>
              </span>
              <span className="text-xs text-tinta-fraca">
                {c.concluidoEm ? (
                  <>
                    concluído por {c.concluidoPor} em {dataHora(c.concluidoEm)} ·{' '}
                    {c.itensLancados} item(ns) com saldo
                  </>
                ) : (
                  <>não concluído · {c.itensLancados} item(ns) lançado(s)</>
                )}
              </span>
            </li>
          ))}
        </ul>
        <p className="border-t border-borda px-4 py-2 text-xs text-tinta-fraca">
          Um local pode ter todos os itens em zero e ainda assim estar contado —
          por isso a conclusão é um ato explícito, com responsável e horário, e
          não algo deduzido da existência de saldo. A praça fica fora do saldo
          nesta etapa.
        </p>
      </section>

      {/* ---------------- lançamento ---------------- */}
      <section className="cartao p-4">
        <label className="rotulo" htmlFor="alvo">
          Onde você está contando
        </label>
        <select
          id="alvo"
          className="campo"
          value={alvo}
          onChange={(e) => {
            setAlvo(e.target.value)
            setValores({})
            setMsg(null)
          }}
        >
          <option value={PRINCIPAL}>
            Estoque Principal
            {checklist.find((c) => c.setorId === null)?.concluidoEm
              ? ' — concluído'
              : ''}
          </option>
          {setores.map((s) => {
            const c = checklist.find((x) => x.setorId === s.id)
            return (
              <option key={s.id} value={s.id}>
                Pulmão — {s.nome}
                {c?.concluidoEm ? ' — concluído' : ''}
              </option>
            )
          })}
        </select>
      </section>

      {alvoConcluido ? (
        <p className="rounded-lg border border-positivo/30 bg-positivo/10 px-4 py-3 text-sm text-positivo">
          Este local já foi concluído e está fechado para lançamento. Se algo
          estiver errado, resolva com a direção antes da virada.
        </p>
      ) : (
        <>
          <section className="cartao p-4">
            <label className="rotulo" htmlFor="busca">
              Itens ({preenchidos.length} preenchido
              {preenchidos.length === 1 ? '' : 's'})
            </label>
            <input
              id="busca"
              type="search"
              className="campo"
              placeholder="Filtrar por nome…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />

            <ul className="mt-3 max-h-[28rem] divide-y divide-borda overflow-auto rounded-lg border border-borda">
              {visiveis.map((i) => {
                const existente = lancadosNoAlvo[i.id]
                return (
                  <li key={i.id} className="flex items-center gap-3 px-3 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {i.nome}
                        {i.critico && (
                          <span className="ml-2 rounded bg-acento-fraco px-1.5 py-0.5 text-[10px] font-semibold text-acento">
                            crítico
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-xs text-tinta-fraca">
                        {i.orientacao_contagem ??
                          `contar em ${i.unidade_contagem}`}
                        {existente !== undefined && (
                          <span className="text-positivo">
                            {' · '}já lançado: {fmt(existente)}
                          </span>
                        )}
                      </span>
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min="0"
                      aria-label={`Quantidade de ${i.nome}`}
                      disabled={existente !== undefined}
                      className="campo w-28 shrink-0 disabled:opacity-40"
                      value={valores[i.id] ?? ''}
                      onChange={(e) =>
                        setValores((v) => ({ ...v, [i.id]: e.target.value }))
                      }
                    />
                  </li>
                )
              })}
            </ul>
          </section>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              className="botao flex-1"
              disabled={ocupado || preenchidos.length === 0}
              onClick={() =>
                agir(
                  () =>
                    lancarInventarioImplantacao(
                      preenchidos.map(([itemId, v]) => ({
                        item_id: itemId,
                        quantidade: Number(v.replace(',', '.')),
                        setor_id: alvo === PRINCIPAL ? null : alvo,
                      })),
                      alvo === PRINCIPAL
                        ? 'Contagem física da virada — Estoque Principal'
                        : 'Contagem física da virada — pulmão',
                    ),
                  `${preenchidos.length} item(ns) lançado(s).`,
                  true,
                )
              }
            >
              {ocupado
                ? 'Lançando…'
                : `Lançar ${preenchidos.length} item(ns)`}
            </button>

            <button
              type="button"
              className="botao-neutro flex-1"
              disabled={ocupado || !linhaAlvo?.localId}
              onClick={() =>
                agir(
                  () => concluirInventarioLocal(linhaAlvo!.localId),
                  'Local concluído. Ele fica fechado para novos lançamentos.',
                  true,
                )
              }
            >
              Concluir a contagem deste local
            </button>
          </div>
        </>
      )}

      {msg && (
        <p
          className={`rounded-lg px-4 py-3 text-sm ${
            msg.ok
              ? 'border border-positivo/30 bg-positivo/10 text-positivo'
              : 'border border-acento/30 bg-acento-fraco text-acento'
          }`}
        >
          {msg.texto}
        </p>
      )}

      {/* ---------------- virada ---------------- */}
      <section className="cartao space-y-3 p-4">
        <h2 className="text-sm font-semibold">Virar a chave</h2>
        {tudoConcluido ? (
          <p className="text-sm text-tinta-fraca">
            Todos os {checklist.length} locais estão concluídos. Marcar a unidade
            como em produção fecha o inventário de implantação em definitivo:
            daí em diante, saldo só muda por fluxo do sistema.
          </p>
        ) : (
          <p className="text-sm text-alerta">
            Falta concluir: {pendentes.map((p) => p.nome).join(', ')}.
          </p>
        )}
        <button
          type="button"
          className="botao"
          disabled={ocupado || !tudoConcluido}
          onClick={() =>
            iniciar(async () => {
              const r = await marcarEmProducao()
              if (r.ok) router.push('/')
              else setMsg({ ok: false, texto: r.erro })
            })
          }
        >
          Marcar unidade como em produção
        </button>
      </section>
    </div>
  )
}
