'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { apurarDivergencia } from '@/lib/operacoes'
import { dataHora, quantidade as fmt } from '@/lib/formato'
import type { Item, Setor } from '@/lib/estoque'

type Divergencia = {
  id: string
  setor_id: string
  item_id: string
  origem: string
  quantidade: number
  criada_em: string
}

type Causa = {
  codigo: string
  nome: string
  aplica_a: string
  exige_motivo: boolean
  fluxo_destino: string | null
}

/**
 * O destino de cada causa, dito em voz alta.
 *
 * A regra é do banco: só ERRO_SEPARACAO devolve ao Principal, porque é a única
 * causa que comprova que a mercadoria nunca saiu. Aqui isso deixa de ser texto
 * escondido e passa a ser o que se lê antes de escolher.
 */
const DESTINO: Record<string, { texto: string; cor: string }> = {
  APURACAO_CORRECAO_REGISTRO: {
    texto: 'volta ao Estoque Principal',
    cor: 'text-positivo',
  },
  APURACAO_RECEBIMENTO_COMPLEMENTAR: {
    texto: 'entra no pulmão',
    cor: 'text-tinta-fraca',
  },
  APURACAO_PERDA_TRANSITO: {
    texto: 'sai do sistema como perda',
    cor: 'text-acento',
  },
}

export function ListaDivergencias({
  pendentes,
  causas,
  itens,
  setores,
  podeApurar,
}: {
  pendentes: Divergencia[]
  causas: Causa[]
  itens: Item[]
  setores: Setor[]
  podeApurar: boolean
}) {
  const router = useRouter()
  const [escolha, setEscolha] = useState<Record<string, string>>({})
  const [motivo, setMotivo] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
  const [ocupado, iniciar] = useTransition()

  const nomeItem = useMemo(
    () => new Map(itens.map((i) => [i.id, i.nome])),
    [itens],
  )
  const nomeSetor = useMemo(
    () => new Map(setores.map((s) => [s.id, s.nome])),
    [setores],
  )

  function idade(iso: string) {
    const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
    return d === 0 ? 'hoje' : d === 1 ? '1 dia' : `${d} dias`
  }

  if (!pendentes.length) {
    return (
      <div className="cartao p-6">
        <h2 className="text-lg font-bold text-positivo">
          Nenhuma divergência pendente
        </h2>
        <p className="mt-2 text-sm text-tinta-fraca">
          Todo resíduo de trânsito foi apurado e nenhuma contagem veio acima do
          esperado.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {pendentes.map((d) => {
        const disponiveis = causas.filter((c) => c.aplica_a === d.origem)
        const escolhida = disponiveis.find((c) => c.codigo === escolha[d.id])
        const precisaMotivo = escolhida?.exige_motivo ?? false
        const motivoOk =
          !precisaMotivo || (motivo[d.id]?.trim().length ?? 0) > 0
        const destino = escolhida?.fluxo_destino
          ? DESTINO[escolhida.fluxo_destino]
          : null

        return (
          <section key={d.id} className="cartao overflow-hidden">
            {/* o fato */}
            <div className="flex items-start justify-between gap-4 border-b border-borda p-4">
              <div className="min-w-0">
                <span
                  className={`inline-block rounded px-2 py-1 text-[11px] font-bold tracking-wide ${
                    d.origem === 'TRANSITO'
                      ? 'bg-alerta/10 text-alerta'
                      : 'bg-acento-fraco text-acento'
                  }`}
                >
                  {d.origem === 'TRANSITO'
                    ? `RESÍDUO EM TRÂNSITO · ${idade(d.criada_em)}`
                    : `CONTAGEM ACIMA · ${idade(d.criada_em)}`}
                </span>
                <h2 className="mt-2 text-lg font-bold leading-snug">
                  {nomeItem.get(d.item_id) ?? d.item_id}
                </h2>
                <p className="mt-0.5 text-sm text-tinta-fraca">
                  {nomeSetor.get(d.setor_id) ?? '—'} ·{' '}
                  {dataHora(d.criada_em)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-3xl font-bold leading-none tabular-nums text-alerta">
                  {fmt(Number(d.quantidade))}
                </p>
              </div>
            </div>

            {d.origem === 'CONTAGEM_ACIMA' && (
              <p className="border-b border-borda bg-acento-fraco px-4 py-2.5 text-xs leading-relaxed text-acento">
                Contagem acima do esperado não cria estoque: apurar aqui apenas
                registra a causa. O saldo do pulmão continua o do razão.
              </p>
            )}

            <div className="space-y-2 p-4">
              <p className="text-sm font-semibold">
                O que aconteceu com {fmt(Number(d.quantidade))}?
              </p>
              <p className="pb-1 text-xs text-tinta-fraca">
                A causa decide para onde o saldo vai
              </p>

              {disponiveis.map((c) => {
                const marcada = escolha[d.id] === c.codigo
                const dest = c.fluxo_destino ? DESTINO[c.fluxo_destino] : null
                return (
                  <button
                    key={c.codigo}
                    type="button"
                    disabled={!podeApurar}
                    onClick={() =>
                      setEscolha((s) => ({ ...s, [d.id]: c.codigo }))
                    }
                    aria-pressed={marcada}
                    className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition disabled:opacity-50 ${
                      marcada
                        ? 'border-2 border-acento bg-acento-fraco/40'
                        : 'border-borda bg-cartao hover:border-acento'
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                        marcada
                          ? 'bg-acento text-white'
                          : 'border-2 border-borda'
                      }`}
                    >
                      {marcada ? '✓' : ''}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[15px] font-semibold leading-snug">
                        {c.nome}
                      </span>
                      {dest && (
                        <span
                          className={`mt-1 block text-[13px] font-medium ${dest.cor}`}
                        >
                          → {dest.texto}
                        </span>
                      )}
                      {c.codigo === 'ERRO_SEPARACAO' && (
                        <span className="mt-1 block text-xs leading-relaxed text-tinta-fraca">
                          A mercadoria nunca saiu da sala, então isto corrige o
                          registro — não é reentrada.
                        </span>
                      )}
                    </span>
                  </button>
                )
              })}

              <div className="pt-1">
                <label className="rotulo" htmlFor={`motivo-${d.id}`}>
                  Motivo{' '}
                  {precisaMotivo && (
                    <span className="font-semibold text-acento">
                      obrigatório
                    </span>
                  )}
                </label>
                <input
                  id={`motivo-${d.id}`}
                  className="campo"
                  value={motivo[d.id] ?? ''}
                  onChange={(e) =>
                    setMotivo((s) => ({ ...s, [d.id]: e.target.value }))
                  }
                  disabled={!podeApurar}
                />
              </div>

              <button
                type="button"
                className="botao mt-1 w-full"
                disabled={ocupado || !podeApurar || !escolha[d.id] || !motivoOk}
                onClick={() =>
                  iniciar(async () => {
                    const r = await apurarDivergencia(
                      d.id,
                      escolha[d.id],
                      motivo[d.id],
                    )
                    if (r.ok) {
                      setMsg({ ok: true, texto: 'Divergência apurada.' })
                      router.refresh()
                    } else setMsg({ ok: false, texto: r.erro })
                  })
                }
              >
                {!podeApurar
                  ? 'Sem permissão para apurar'
                  : destino
                    ? `Apurar — ${destino.texto}`
                    : 'Apurar'}
              </button>
            </div>
          </section>
        )
      })}

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
    </div>
  )
}
