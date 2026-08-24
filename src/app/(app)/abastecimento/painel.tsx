'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  ajustarSeparacao,
  confirmarRecebimento,
  confirmarSeparacao,
  gerarRodada,
} from '@/lib/operacoes'
import { quantidade as fmt } from '@/lib/formato'
import type { ContagemItem, Item, RodadaItem, Setor } from '@/lib/estoque'

type Props = {
  ciclo: string
  setores: Setor[]
  setorId: string
  itens: Item[]
  minimos: Record<string, number>
  contagem: { id: string; situacao: string } | null
  itensContados: ContagemItem[]
  rodada: { id: string; situacao: string } | null
  itensRodada: RodadaItem[]
  saldoPrincipal: Record<string, number>
  saldoTransito: Record<string, number>
  podeSeparar: boolean
  podeReceber: boolean
}

export function PainelAbastecimento(p: Props) {
  const router = useRouter()
  const [ajustes, setAjustes] = useState<Record<string, string>>({})
  const [motivo, setMotivo] = useState('')
  const [recebidos, setRecebidos] = useState<Record<string, number>>({})
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
  const [ocupado, iniciar] = useTransition()

  const itemDe = useMemo(() => new Map(p.itens.map((i) => [i.id, i])), [p.itens])
  const contados = useMemo(
    () =>
      new Map(p.itensContados.map((i) => [i.item_id, Number(i.quantidade)])),
    [p.itensContados],
  )

  const situacao = p.rodada?.situacao ?? null
  const linhas = p.itensRodada

  const separadoDe = (r: RodadaItem) => Number(r.qtd_separada ?? r.qtd_sugerida)
  const aSepararDe = (r: RodadaItem) => {
    const bruto = ajustes[r.item_id]
    if (bruto === undefined || bruto.trim() === '') return separadoDe(r)
    const q = Number(bruto.replace(',', '.'))
    return Number.isFinite(q) && q >= 0 ? q : separadoDe(r)
  }
  const recebidoDe = (r: RodadaItem) =>
    recebidos[r.item_id] ?? separadoDe(r)

  const totalSugerido = linhas.reduce((s, r) => s + Number(r.qtd_sugerida), 0)
  const totalSeparar = linhas.reduce((s, r) => s + aSepararDe(r), 0)
  const ajustados = linhas.filter(
    (r) => aSepararDe(r) !== Number(r.qtd_sugerida),
  ).length
  const faltando = linhas.reduce(
    (s, r) => s + (separadoDe(r) - recebidoDe(r)),
    0,
  )

  const abas = (
    <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
      {p.setores.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() =>
            router.push(`/abastecimento?setor=${s.id}&ciclo=${p.ciclo}`)
          }
          aria-pressed={s.id === p.setorId}
          className={`min-h-10 shrink-0 rounded-lg border px-3.5 text-sm font-medium transition ${
            s.id === p.setorId
              ? 'border-acento bg-acento text-white'
              : 'border-borda bg-cartao text-tinta-fraca'
          }`}
        >
          {s.nome}
        </button>
      ))}
      <span className="shrink-0 pl-1 text-xs text-tinta-fraca">{p.ciclo}</span>
    </div>
  )

  // ------------------------------------------------- sem contagem fechada
  if (!p.contagem || p.contagem.situacao !== 'FINALIZADA') {
    return (
      <div className="space-y-4">
        {abas}
        <div className="cartao p-6">
          <h2 className="text-lg font-bold">Falta a contagem do pulmão</h2>
          <p className="mt-2 text-sm leading-relaxed text-tinta-fraca">
            O abastecimento nasce da contagem: sem saber o que restou, não há
            como calcular o que repor.
          </p>
        </div>
      </div>
    )
  }

  // ------------------------------------------------------- gerar sugestão
  if (!p.rodada) {
    const semMinimo = Object.keys(p.minimos).length === 0
    return (
      <div className="space-y-4">
        {abas}
        <div className="cartao p-6">
          <h2 className="text-lg font-bold">Gerar a sugestão</h2>
          <p
            className={`mt-2 text-sm leading-relaxed ${semMinimo ? 'text-alerta' : 'text-tinta-fraca'}`}
          >
            {semMinimo
              ? 'Nenhum mínimo de pulmão definido para este setor. Sem mínimo não existe sugestão.'
              : `${Object.keys(p.minimos).length} item(ns) com mínimo definido neste setor.`}
          </p>
          <button
            type="button"
            className="botao mt-4 w-full sm:w-auto"
            disabled={ocupado || !p.podeSeparar || semMinimo}
            onClick={() =>
              iniciar(async () => {
                const r = await gerarRodada(p.contagem!.id)
                if (r.ok) router.refresh()
                else setMsg({ ok: false, texto: r.erro })
              })
            }
          >
            {ocupado ? 'Gerando…' : 'Gerar sugestão de reposição'}
          </button>
        </div>
        {msg && <Aviso msg={msg} />}
      </div>
    )
  }

  // ----------------------------------------------------------- recebimento
  if (situacao === 'SEPARADA') {
    return (
      <div className="space-y-4">
        {abas}

        <div className="flex items-start gap-2.5 rounded-lg border border-acento/20 bg-acento-fraco px-4 py-3">
          <span className="mt-0.5 shrink-0 text-acento" aria-hidden="true">
            <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><circle cx="10" cy="10" r="7.5" /><path d="M10 6.5v.01M10 9v4.5" /></svg>
          </span>
          <p className="text-sm leading-relaxed text-acento">
            Confira o que chegou. Se vier menos, ajuste no item — a diferença
            <strong> não desaparece</strong>, fica como divergência para
            apuração.
          </p>
        </div>

        <ul className="space-y-2.5">
          {linhas.map((r) => {
            const item = itemDe.get(r.item_id)
            const separado = separadoDe(r)
            const recebido = recebidoDe(r)
            const completo = recebido === separado
            return (
              <li
                key={r.item_id}
                className={`cartao p-3.5 ${completo ? '' : 'border-2 border-alerta'}`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-white ${
                      completo ? 'bg-positivo' : 'bg-alerta/20 text-alerta'
                    }`}
                    aria-hidden="true"
                  >
                    {completo ? (
                      <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10.5l4 4 8-8" /></svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 10h8" /></svg>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">
                      {item?.nome ?? r.item_id}
                    </span>
                    <span
                      className={`block text-[13px] ${completo ? 'text-tinta-fraca' : 'font-medium text-alerta'}`}
                    >
                      {completo
                        ? `${fmt(separado)} ${item?.unidade_contagem ?? ''} separadas`
                        : `faltaram ${fmt(separado - recebido)} · vai para apuração`}
                    </span>
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <button
                    type="button"
                    aria-label={`Diminuir ${item?.nome}`}
                    disabled={recebido <= 0}
                    onClick={() =>
                      setRecebidos((s) => ({
                        ...s,
                        [r.item_id]: Math.max(0, recebido - 1),
                      }))
                    }
                    className="flex h-12 w-14 shrink-0 items-center justify-center rounded-lg border border-borda bg-cartao text-tinta transition active:bg-papel disabled:opacity-40"
                  >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 10h10" /></svg>
                  </button>
                  <span className="flex-1 text-center">
                    {/* Os botoes resolvem unidade; o campo resolve kg. Sem ele,
                        receber 11,3 de 12,5 seria impossivel. */}
                    <input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min="0"
                      max={separado}
                      aria-label={`Recebido de ${item?.nome ?? ''}`}
                      className="w-full border-0 bg-transparent p-0 text-center text-2xl font-bold leading-none tabular-nums text-tinta outline-none focus:text-acento"
                      value={recebido}
                      onChange={(e) => {
                        const q = Number(e.target.value.replace(',', '.'))
                        setRecebidos((s) => ({
                          ...s,
                          [r.item_id]: Number.isFinite(q)
                            ? Math.min(separado, Math.max(0, q))
                            : 0,
                        }))
                      }}
                    />
                    <span className="mt-1 block text-xs text-tinta-fraca">
                      de {fmt(separado)} separadas
                    </span>
                  </span>
                  <button
                    type="button"
                    aria-label={`Aumentar ${item?.nome}`}
                    disabled={recebido >= separado}
                    onClick={() =>
                      setRecebidos((s) => ({
                        ...s,
                        [r.item_id]: Math.min(separado, recebido + 1),
                      }))
                    }
                    className="flex h-12 w-14 shrink-0 items-center justify-center rounded-lg border border-borda bg-cartao text-tinta transition active:bg-papel disabled:opacity-40"
                  >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M10 5v10M5 10h10" /></svg>
                  </button>
                </div>
              </li>
            )
          })}
        </ul>

        <div className="cartao space-y-3 p-4">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-tinta-fraca">
              {linhas.length} itens conferidos
            </span>
            <span
              className={`font-semibold ${faltando > 0 ? 'text-alerta' : 'text-positivo'}`}
            >
              {faltando > 0 ? `${fmt(faltando)} para apurar` : 'tudo completo'}
            </span>
          </div>
          <button
            type="button"
            className="botao w-full"
            disabled={ocupado || !p.podeReceber}
            onClick={() =>
              iniciar(async () => {
                const r = await confirmarRecebimento(
                  p.rodada!.id,
                  linhas.map((l) => ({
                    item_id: l.item_id,
                    quantidade: recebidoDe(l),
                  })),
                )
                if (r.ok) {
                  setRecebidos({})
                  router.refresh()
                } else setMsg({ ok: false, texto: r.erro })
              })
            }
          >
            {!p.podeReceber
              ? 'Só o líder do setor confirma o recebimento'
              : ocupado
                ? 'Confirmando…'
                : 'Confirmar recebimento'}
          </button>
        </div>

        {msg && <Aviso msg={msg} />}
        <ResiduoTransito saldo={p.saldoTransito} itemDe={itemDe} />
      </div>
    )
  }

  // ------------------------------------------------------ rodada concluída
  if (situacao === 'RECEBIDA') {
    return (
      <div className="space-y-4">
        {abas}
        <div className="cartao p-6">
          <h2 className="text-lg font-bold text-positivo">Rodada concluída</h2>
          <p className="mt-2 text-sm text-tinta-fraca">
            {linhas.length} itens · pulmão do{' '}
            {p.setores.find((s) => s.id === p.setorId)?.nome} abastecido neste
            ciclo.
          </p>
        </div>
        <ResiduoTransito saldo={p.saldoTransito} itemDe={itemDe} />
      </div>
    )
  }

  // -------------------------------------------------------------- separação
  const campoSeparar = (r: RodadaItem) => (
    <input
      type="number"
      inputMode="decimal"
      step="any"
      min="0"
      aria-label={`Separar ${itemDe.get(r.item_id)?.nome ?? ''}`}
      className={`campo w-full text-center text-lg font-semibold tabular-nums ${
        aSepararDe(r) !== Number(r.qtd_sugerida)
          ? 'border-2 border-acento text-acento'
          : ''
      }`}
      placeholder={String(separadoDe(r))}
      value={ajustes[r.item_id] ?? ''}
      onChange={(e) =>
        setAjustes((a) => ({ ...a, [r.item_id]: e.target.value }))
      }
    />
  )

  const confirmar = (
    <button
      type="button"
      className="botao w-full"
      disabled={ocupado || !p.podeSeparar || linhas.length === 0}
      onClick={() =>
        iniciar(async () => {
          for (const r of linhas) {
            const q = aSepararDe(r)
            if (q === Number(r.qtd_separada ?? r.qtd_sugerida) && !ajustes[r.item_id]) continue
            const res = await ajustarSeparacao(
              p.rodada!.id,
              r.item_id,
              q,
              motivo || undefined,
            )
            if (!res.ok) return setMsg({ ok: false, texto: res.erro })
          }
          const res = await confirmarSeparacao(p.rodada!.id)
          if (res.ok) {
            setAjustes({})
            setMotivo('')
            router.refresh()
          } else setMsg({ ok: false, texto: res.erro })
        })
      }
    >
      {ocupado ? 'Confirmando…' : `Confirmar separação de ${fmt(totalSeparar)}`}
    </button>
  )

  const trilho = (
    <div className="space-y-3">
      <div className="cartao p-4">
        <h3 className="mb-3 text-sm font-semibold">Resumo</h3>
        {[
          ['Itens', String(linhas.length)],
          ['Sugerido', fmt(totalSugerido)],
          ['A separar', fmt(totalSeparar)],
        ].map(([k, v], n) => (
          <div
            key={k}
            className={`flex justify-between py-1.5 text-sm ${n ? 'border-t border-borda' : ''}`}
          >
            <span className="text-tinta-fraca">{k}</span>
            <span className="font-semibold tabular-nums">{v}</span>
          </div>
        ))}
        {ajustados > 0 && (
          <div className="flex justify-between border-t border-borda py-1.5 text-sm">
            <span className="text-alerta">Ajustados</span>
            <span className="font-semibold tabular-nums text-alerta">
              {ajustados}
            </span>
          </div>
        )}
      </div>

      <div className="cartao p-4">
        <label className="rotulo" htmlFor="motivo">
          Motivo do ajuste
        </label>
        <input
          id="motivo"
          className="campo"
          placeholder="Ex.: segunda fraca, 24 sustenta o dia"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
        />
        <p className="mt-2 text-xs leading-relaxed text-tinta-fraca">
          Fica no histórico ao lado do sugerido — é esse par que depois mostra
          se o mínimo está mal calibrado.
        </p>
      </div>

      <div className="cartao flex items-start gap-2.5 p-4">
        <span className="mt-0.5 shrink-0 text-tinta-fraca" aria-hidden="true">
          <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2.5l6 2.5v5c0 3.5-2.6 6.3-6 7.5-3.4-1.2-6-4-6-7.5V5l6-2.5z" /></svg>
        </span>
        <p className="text-[13px] leading-relaxed text-tinta-fraca">
          Ao confirmar, a mercadoria sai do Principal e fica{' '}
          <strong className="text-tinta">em trânsito</strong> até o líder
          receber. Quem separa não recebe.
        </p>
      </div>

      {confirmar}
    </div>
  )

  return (
    <div className="space-y-4">
      {abas}

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-5">
        {/* tabela no PC */}
        <div className="cartao hidden overflow-hidden lg:block">
          <div className="flex items-baseline justify-between border-b border-borda px-4 py-3">
            <h2 className="text-sm font-semibold">
              {linhas.length} itens sugeridos
            </h2>
            <span className="text-xs text-tinta-fraca">
              sugestão = mínimo do pulmão − contado · não é ordem
            </span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-borda text-left text-xs text-tinta-fraca">
                <th className="px-4 py-2 font-semibold">ITEM</th>
                <th className="px-2 py-2 text-right font-semibold">MÍN.</th>
                <th className="px-2 py-2 text-right font-semibold">CONTADO</th>
                <th className="px-2 py-2 text-right font-semibold">SUGERIDO</th>
                <th className="w-28 px-2 py-2 text-center font-semibold">SEPARAR</th>
                <th className="px-4 py-2 text-right font-semibold">PRINCIPAL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borda">
              {linhas.map((r) => {
                const item = itemDe.get(r.item_id)
                const sobra = (p.saldoPrincipal[r.item_id] ?? 0) - aSepararDe(r)
                return (
                  <tr key={r.item_id} className={ajustes[r.item_id] ? 'bg-acento-fraco/50' : ''}>
                    <td className="px-4 py-2.5">
                      <span className="block font-medium">{item?.nome}</span>
                      <span className="text-xs text-tinta-fraca">
                        {item?.unidade_contagem}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-tinta-fraca">
                      {fmt(p.minimos[r.item_id] ?? 0)}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-tinta-fraca">
                      {fmt(contados.get(r.item_id) ?? 0)}
                    </td>
                    <td className="px-2 py-2.5 text-right font-semibold tabular-nums">
                      {fmt(Number(r.qtd_sugerida))}
                    </td>
                    <td className="px-2 py-2">{campoSeparar(r)}</td>
                    <td
                      className={`px-4 py-2.5 text-right tabular-nums ${sobra <= 1 ? 'font-semibold text-alerta' : 'text-tinta-fraca'}`}
                    >
                      {fmt(p.saldoPrincipal[r.item_id] ?? 0)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {linhas.length === 0 && (
            <p className="px-4 py-6 text-sm text-tinta-fraca">
              Nada a repor: todos os itens com mínimo estão no nível.
            </p>
          )}
        </div>

        {/* cartões no celular */}
        <ul className="space-y-2.5 lg:hidden">
          {linhas.map((r) => {
            const item = itemDe.get(r.item_id)
            return (
              <li key={r.item_id} className="cartao p-3.5">
                <div className="mb-2.5">
                  <span className="block text-[15px] font-semibold">
                    {item?.nome}
                  </span>
                  <span className="text-[13px] text-tinta-fraca">
                    mínimo {fmt(p.minimos[r.item_id] ?? 0)} · contado{' '}
                    {fmt(contados.get(r.item_id) ?? 0)} · no principal{' '}
                    {fmt(p.saldoPrincipal[r.item_id] ?? 0)}
                  </span>
                </div>
                <div className="flex items-end gap-3">
                  <span className="flex-1">
                    <span className="rotulo">Sugerido</span>
                    <span className="block text-xl font-bold tabular-nums">
                      {fmt(Number(r.qtd_sugerida))}
                    </span>
                  </span>
                  <span className="flex-1">
                    <span className="rotulo">Separar</span>
                    {campoSeparar(r)}
                  </span>
                </div>
              </li>
            )
          })}
          {linhas.length === 0 && (
            <li className="cartao p-6 text-sm text-tinta-fraca">
              Nada a repor: todos os itens com mínimo estão no nível.
            </li>
          )}
        </ul>

        <div className="mt-4 lg:mt-0">{trilho}</div>
      </div>

      {msg && <Aviso msg={msg} />}
      <ResiduoTransito saldo={p.saldoTransito} itemDe={itemDe} />
    </div>
  )
}

function ResiduoTransito({
  saldo,
  itemDe,
}: {
  saldo: Record<string, number>
  itemDe: Map<string, Item>
}) {
  const linhas = Object.entries(saldo).filter(([, q]) => q > 0)
  if (!linhas.length) return null
  return (
    <section className="cartao p-4">
      <h2 className="text-sm font-semibold text-alerta">
        Resíduo em trânsito neste setor
      </h2>
      <ul className="mt-2 divide-y divide-borda text-sm">
        {linhas.map(([itemId, q]) => (
          <li key={itemId} className="flex justify-between gap-3 py-2">
            <span className="truncate">{itemDe.get(itemId)?.nome ?? itemId}</span>
            <span className="tabular-nums">{fmt(q)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs leading-relaxed text-tinta-fraca">
        Resolva em <strong>Divergências</strong>. Enquanto não for apurado, o
        resíduo permanece no razão — não some.
      </p>
    </section>
  )
}

function Aviso({ msg }: { msg: { ok: boolean; texto: string } }) {
  return (
    <p
      className={`rounded-lg px-4 py-3 text-sm ${
        msg.ok
          ? 'border border-positivo/30 bg-positivo/10 text-positivo'
          : 'border border-acento/30 bg-acento-fraco text-acento'
      }`}
    >
      {msg.texto}
    </p>
  )
}
