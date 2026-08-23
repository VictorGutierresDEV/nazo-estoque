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
  const [motivos, setMotivos] = useState<Record<string, string>>({})
  const [recebidos, setRecebidos] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
  const [ocupado, iniciar] = useTransition()

  const nomeDe = useMemo(
    () => new Map(p.itens.map((i) => [i.id, i])),
    [p.itens],
  )
  const contados = useMemo(
    () =>
      Object.fromEntries(
        p.itensContados.map((i) => [i.item_id, Number(i.quantidade)]),
      ),
    [p.itensContados],
  )

  const situacao = p.rodada?.situacao ?? null

  function trocarSetor(id: string) {
    router.push(`/abastecimento?setor=${id}&ciclo=${p.ciclo}`)
  }

  function acao(fn: () => Promise<{ ok: boolean; erro?: string }>, sucesso: string) {
    iniciar(async () => {
      const r = await fn()
      if (r.ok) {
        setMsg({ ok: true, texto: sucesso })
        setAjustes({})
        setRecebidos({})
        router.refresh()
      } else {
        setMsg({ ok: false, texto: r.erro ?? 'Falhou.' })
      }
    })
  }

  const abas = (
    <section className="cartao p-4">
      <h2 className="rotulo">Setor</h2>
      <div className="flex flex-wrap gap-2">
        {p.setores.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => trocarSetor(s.id)}
            aria-pressed={s.id === p.setorId}
            className={`min-h-12 rounded-lg border px-4 text-base font-medium transition ${
              s.id === p.setorId
                ? 'border-acento bg-acento text-white'
                : 'border-borda bg-cartao hover:border-acento'
            }`}
          >
            {s.nome}
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-tinta-fraca">
        Ciclo <strong>{p.ciclo}</strong>
        {situacao && ` · rodada ${situacao.toLowerCase()}`}
      </p>
    </section>
  )

  // ---- sem contagem finalizada -------------------------------------------
  if (!p.contagem || p.contagem.situacao !== 'FINALIZADA') {
    return (
      <div className="space-y-5">
        {abas}
        <div className="cartao p-6">
          <h2 className="text-lg font-bold">Falta a contagem do pulmão</h2>
          <p className="mt-2 text-sm text-tinta-fraca">
            O abastecimento nasce da contagem: sem saber o que restou, não há
            como calcular o que repor. Finalize a contagem deste ciclo primeiro.
          </p>
        </div>
      </div>
    )
  }

  // ---- contagem pronta, rodada ainda não gerada ---------------------------
  if (!p.rodada) {
    const semMinimo = Object.keys(p.minimos).length === 0
    return (
      <div className="space-y-5">
        {abas}
        <div className="cartao p-6">
          <h2 className="text-lg font-bold">Gerar a sugestão</h2>
          {semMinimo ? (
            <p className="mt-2 text-sm text-alerta">
              Nenhum mínimo de pulmão definido para este setor. Sem mínimo não
              existe sugestão — defina em <strong>Mínimos</strong>.
            </p>
          ) : (
            <p className="mt-2 text-sm text-tinta-fraca">
              {Object.keys(p.minimos).length} item(ns) com mínimo definido neste
              setor.
            </p>
          )}
          <button
            type="button"
            className="botao mt-4"
            disabled={ocupado || !p.podeSeparar || semMinimo}
            onClick={() =>
              acao(
                () => gerarRodada(p.contagem!.id),
                'Sugestão gerada.',
              )
            }
          >
            {ocupado ? 'Gerando…' : 'Gerar sugestão de reposição'}
          </button>
        </div>
        {msg && <Aviso msg={msg} />}
      </div>
    )
  }

  // ---- rodada existente ---------------------------------------------------
  return (
    <div className="space-y-5">
      {abas}

      <section className="cartao overflow-hidden">
        <h2 className="border-b border-borda px-4 py-3 text-sm font-semibold">
          {situacao === 'SUGERIDA' && 'Separação — revise e confirme'}
          {situacao === 'SEPARADA' && 'Aguardando o líder confirmar o recebimento'}
          {situacao === 'RECEBIDA' && 'Rodada concluída'}
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-b border-borda text-left text-tinta-fraca">
                <th className="px-4 py-2 font-medium">Item</th>
                <th className="px-3 py-2 text-right font-medium">Mín.</th>
                <th className="px-3 py-2 text-right font-medium">Contado</th>
                <th className="px-3 py-2 text-right font-medium">Sugerido</th>
                <th className="px-3 py-2 text-right font-medium">Separado</th>
                {situacao !== 'SUGERIDA' && (
                  <th className="px-3 py-2 text-right font-medium">Recebido</th>
                )}
                <th className="px-3 py-2 text-right font-medium">No principal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borda">
              {p.itensRodada.map((r) => {
                const item = nomeDe.get(r.item_id)
                const separado = r.qtd_separada ?? r.qtd_sugerida
                return (
                  <tr key={r.item_id}>
                    <td className="px-4 py-2">
                      <span className="block">{item?.nome ?? r.item_id}</span>
                      {r.motivo_ajuste && (
                        <span className="block text-xs text-tinta-fraca">
                          {r.motivo_ajuste}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-tinta-fraca">
                      {fmt(p.minimos[r.item_id] ?? 0)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-tinta-fraca">
                      {fmt(contados[r.item_id] ?? 0)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {fmt(Number(r.qtd_sugerida))}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {situacao === 'SUGERIDA' ? (
                        <input
                          type="number"
                          inputMode="decimal"
                          step="any"
                          min="0"
                          aria-label={`Separar ${item?.nome}`}
                          className="campo w-24 text-right"
                          placeholder={String(separado)}
                          value={ajustes[r.item_id] ?? ''}
                          onChange={(e) =>
                            setAjustes((a) => ({ ...a, [r.item_id]: e.target.value }))
                          }
                        />
                      ) : (
                        <span className="tabular-nums font-medium">
                          {fmt(Number(separado))}
                        </span>
                      )}
                    </td>
                    {situacao !== 'SUGERIDA' && (
                      <td className="px-3 py-2 text-right">
                        {situacao === 'SEPARADA' ? (
                          <input
                            type="number"
                            inputMode="decimal"
                            step="any"
                            min="0"
                            max={Number(separado)}
                            aria-label={`Recebido de ${item?.nome}`}
                            className="campo w-24 text-right"
                            placeholder={String(separado)}
                            value={recebidos[r.item_id] ?? ''}
                            onChange={(e) =>
                              setRecebidos((a) => ({
                                ...a,
                                [r.item_id]: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          <span className="tabular-nums font-medium">
                            {fmt(Number(r.qtd_recebida ?? 0))}
                          </span>
                        )}
                      </td>
                    )}
                    <td className="px-3 py-2 text-right tabular-nums text-tinta-fraca">
                      {fmt(p.saldoPrincipal[r.item_id] ?? 0)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {p.itensRodada.length === 0 && (
          <p className="px-4 py-6 text-sm text-tinta-fraca">
            Nada a repor: todos os itens com mínimo definido estão no nível.
          </p>
        )}
      </section>

      {situacao === 'SUGERIDA' && p.itensRodada.length > 0 && (
        <section className="cartao space-y-3 p-4">
          <div>
            <label className="rotulo" htmlFor="motivo-geral">
              Motivo do ajuste (quando mudar a sugestão)
            </label>
            <input
              id="motivo-geral"
              className="campo"
              placeholder="Ex.: operação pediu menos por queda de movimento"
              value={motivos.geral ?? ''}
              onChange={(e) => setMotivos({ geral: e.target.value })}
            />
          </div>
          <button
            type="button"
            className="botao w-full"
            disabled={ocupado || !p.podeSeparar}
            onClick={() =>
              iniciar(async () => {
                for (const [itemId, v] of Object.entries(ajustes)) {
                  if (!v.trim()) continue
                  const q = Number(v.replace(',', '.'))
                  if (!Number.isFinite(q) || q < 0) continue
                  const r = await ajustarSeparacao(
                    p.rodada!.id,
                    itemId,
                    q,
                    motivos.geral,
                  )
                  if (!r.ok) {
                    setMsg({ ok: false, texto: r.erro })
                    return
                  }
                }
                const r = await confirmarSeparacao(p.rodada!.id)
                if (r.ok) {
                  setMsg({
                    ok: true,
                    texto:
                      'Separação confirmada. Saiu do Estoque Principal e está em trânsito, aguardando o líder.',
                  })
                  setAjustes({})
                  router.refresh()
                } else setMsg({ ok: false, texto: r.erro })
              })
            }
          >
            {ocupado ? 'Confirmando…' : 'Confirmar separação'}
          </button>
        </section>
      )}

      {situacao === 'SEPARADA' && (
        <section className="cartao space-y-3 p-4">
          <p className="text-sm text-tinta-fraca">
            Deixe em branco para confirmar o total separado. Se receber menos, a
            diferença <strong>não desaparece</strong>: fica como divergência
            pendente em trânsito, e a operação segue.
          </p>
          <button
            type="button"
            className="botao w-full"
            disabled={ocupado || !p.podeReceber}
            onClick={() =>
              acao(async () => {
                const lista = p.itensRodada
                  .filter((r) => (r.qtd_separada ?? 0) > 0)
                  .map((r) => {
                    const bruto = recebidos[r.item_id]
                    const q =
                      bruto && bruto.trim() !== ''
                        ? Number(bruto.replace(',', '.'))
                        : Number(r.qtd_separada)
                    return { item_id: r.item_id, quantidade: q }
                  })
                return confirmarRecebimento(p.rodada!.id, lista)
              }, 'Recebimento confirmado.')
            }
          >
            {p.podeReceber
              ? ocupado
                ? 'Confirmando…'
                : 'Confirmar recebimento no pulmão'
              : 'Só o líder do setor confirma o recebimento'}
          </button>
        </section>
      )}

      {Object.values(p.saldoTransito).some((q) => q > 0) && (
        <section className="cartao p-4">
          <h2 className="text-sm font-semibold text-alerta">
            Resíduo em trânsito neste setor
          </h2>
          <ul className="mt-2 divide-y divide-borda text-sm">
            {Object.entries(p.saldoTransito)
              .filter(([, q]) => q > 0)
              .map(([itemId, q]) => (
                <li key={itemId} className="flex justify-between gap-3 py-2">
                  <span className="truncate">
                    {nomeDe.get(itemId)?.nome ?? itemId}
                  </span>
                  <span className="tabular-nums">{fmt(q)}</span>
                </li>
              ))}
          </ul>
          <p className="mt-2 text-xs text-tinta-fraca">
            Resolva em <strong>Divergências</strong>. Enquanto não for apurado, o
            resíduo permanece no razão — não some.
          </p>
        </section>
      )}

      {msg && <Aviso msg={msg} />}
    </div>
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
