'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  lancarInventarioImplantacao,
  marcarEmProducao,
} from '@/lib/operacoes'
import { quantidade as fmt } from '@/lib/formato'
import type { Item, Setor } from '@/lib/estoque'

type Props = {
  itens: Item[]
  setores: Setor[]
  /** jaLancados['__principal__' | setorId][itemId] = saldo já existente */
  jaLancados: Record<string, Record<string, number>>
  totalLancado: number
}

const PRINCIPAL = '__principal__'

export function FormImplantacao({
  itens,
  setores,
  jaLancados,
  totalLancado,
}: Props) {
  const router = useRouter()
  const [alvo, setAlvo] = useState<string>(PRINCIPAL)
  const [busca, setBusca] = useState('')
  const [valores, setValores] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
  const [enviando, iniciar] = useTransition()

  const lancadosNoAlvo = jaLancados[alvo] ?? {}

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return itens.filter((i) => !termo || i.nome.toLowerCase().includes(termo))
  }, [itens, busca])

  const preenchidos = Object.entries(valores).filter(
    ([, v]) => v.trim() !== '' && Number(v.replace(',', '.')) > 0,
  )

  function gravar() {
    const lista = preenchidos.map(([itemId, v]) => ({
      item_id: itemId,
      quantidade: Number(v.replace(',', '.')),
      setor_id: alvo === PRINCIPAL ? null : alvo,
    }))

    iniciar(async () => {
      const r = await lancarInventarioImplantacao(
        lista,
        alvo === PRINCIPAL
          ? 'Contagem física da virada — Estoque Principal'
          : 'Contagem física da virada — pulmão',
      )
      if (r.ok) {
        setMsg({
          ok: true,
          texto: `${lista.length} item(ns) lançado(s). Pode seguir para o próximo local.`,
        })
        setValores({})
        router.refresh()
      } else {
        setMsg({ ok: false, texto: r.erro })
      }
    })
  }

  function virarChave() {
    iniciar(async () => {
      const r = await marcarEmProducao()
      if (r.ok) router.push('/')
      else setMsg({ ok: false, texto: r.erro })
    })
  }

  return (
    <div className="space-y-5">
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
          <option value={PRINCIPAL}>Estoque Principal</option>
          {setores.map((s) => (
            <option key={s.id} value={s.id}>
              Pulmão — {s.nome}
            </option>
          ))}
        </select>
      </section>

      <section className="cartao p-4">
        <label className="rotulo" htmlFor="busca">
          Itens ({preenchidos.length} preenchido{preenchidos.length === 1 ? '' : 's'})
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
              <li
                key={i.id}
                className="flex items-center gap-3 px-3 py-2.5"
              >
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
                    {i.orientacao_contagem ?? `contar em ${i.unidade_contagem}`}
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

      <button
        type="button"
        onClick={gravar}
        className="botao w-full"
        disabled={enviando || preenchidos.length === 0}
      >
        {enviando
          ? 'Lançando…'
          : `Lançar ${preenchidos.length} item(ns) neste local`}
      </button>

      <section className="cartao space-y-3 p-4">
        <h2 className="text-sm font-semibold">Virar a chave</h2>
        <p className="text-sm text-tinta-fraca">
          {totalLancado} lançamento(s) de saldo inicial até agora. Ao marcar a
          unidade como em produção, esta tela fecha em definitivo e qualquer
          mudança de saldo passa a exigir um fluxo do sistema. Faça isso
          somente quando o Estoque Principal e todos os pulmões estiverem
          contados.
        </p>
        <button
          type="button"
          onClick={virarChave}
          className="botao-neutro"
          disabled={enviando || totalLancado === 0}
        >
          Marcar unidade como em produção
        </button>
      </section>
    </div>
  )
}
