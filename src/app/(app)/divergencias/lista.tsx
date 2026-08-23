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

const DESTINO_LEGIVEL: Record<string, string> = {
  APURACAO_CORRECAO_REGISTRO: 'volta ao Estoque Principal',
  APURACAO_RECEBIMENTO_COMPLEMENTAR: 'entra no pulmão',
  APURACAO_PERDA_TRANSITO: 'sai do sistema como perda',
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
    const dias = Math.floor(
      (Date.now() - new Date(iso).getTime()) / 86_400_000,
    )
    if (dias === 0) return 'hoje'
    if (dias === 1) return '1 dia'
    return `${dias} dias`
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
    <div className="space-y-4">
      {pendentes.map((d) => {
        const disponiveis = causas.filter((c) => c.aplica_a === d.origem)
        const causaEscolhida = disponiveis.find(
          (c) => c.codigo === escolha[d.id],
        )
        const precisaMotivo = causaEscolhida?.exige_motivo ?? false
        const motivoOk = !precisaMotivo || (motivo[d.id]?.trim().length ?? 0) > 0

        return (
          <section key={d.id} className="cartao space-y-3 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <span
                  className={`rounded px-2 py-0.5 text-xs font-semibold ${
                    d.origem === 'TRANSITO'
                      ? 'bg-alerta/15 text-alerta'
                      : 'bg-acento-fraco text-acento'
                  }`}
                >
                  {d.origem === 'TRANSITO'
                    ? 'resíduo em trânsito'
                    : 'contagem acima do esperado'}
                </span>
                <p className="mt-1.5 font-medium">
                  {nomeItem.get(d.item_id) ?? d.item_id}
                </p>
                <p className="text-sm text-tinta-fraca">
                  {nomeSetor.get(d.setor_id) ?? '—'} ·{' '}
                  <strong className="text-tinta">
                    {fmt(Number(d.quantidade))}
                  </strong>
                </p>
              </div>
              <div className="text-right text-xs text-tinta-fraca">
                <p>{dataHora(d.criada_em)}</p>
                <p className="font-semibold text-alerta">
                  pendente há {idade(d.criada_em)}
                </p>
              </div>
            </div>

            {d.origem === 'CONTAGEM_ACIMA' && (
              <p className="rounded-lg bg-acento-fraco px-3 py-2 text-xs text-acento">
                Contagem acima do esperado não cria estoque: apurar aqui apenas
                registra a causa. O saldo do pulmão continua o do razão.
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="rotulo" htmlFor={`causa-${d.id}`}>
                  Causa
                </label>
                <select
                  id={`causa-${d.id}`}
                  className="campo"
                  value={escolha[d.id] ?? ''}
                  onChange={(e) =>
                    setEscolha((s) => ({ ...s, [d.id]: e.target.value }))
                  }
                  disabled={!podeApurar}
                >
                  <option value="">Escolha…</option>
                  {disponiveis.map((c) => (
                    <option key={c.codigo} value={c.codigo}>
                      {c.nome}
                    </option>
                  ))}
                </select>
                {causaEscolhida?.fluxo_destino && (
                  <p className="mt-1.5 text-xs text-tinta-fraca">
                    Destino: {DESTINO_LEGIVEL[causaEscolhida.fluxo_destino]}
                  </p>
                )}
              </div>

              <div>
                <label className="rotulo" htmlFor={`motivo-${d.id}`}>
                  Motivo {precisaMotivo && <span className="text-acento">*</span>}
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
            </div>

            <button
              type="button"
              className="botao"
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
              {podeApurar ? 'Apurar' : 'Sem permissão para apurar'}
            </button>
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
