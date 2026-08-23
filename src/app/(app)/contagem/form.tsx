'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  abrirContagem,
  finalizarContagem,
  lancarContagemItem,
} from '@/lib/operacoes'
import { quantidade as fmt } from '@/lib/formato'
import type { ContagemItem, Item, Setor } from '@/lib/estoque'

type Contagem = {
  id: string
  situacao: string
  lider_responsavel: string | null
  finalizada_em: string | null
} | null

type Props = {
  ciclo: string
  setores: Setor[]
  setorId: string
  itens: Item[]
  saldoPulmao: Record<string, number>
  contagem: Contagem
  itensContados: ContagemItem[]
  lideres: { id: string; nome: string; funcao: string }[]
  podeFinalizar: boolean
}

export function FormContagem(p: Props) {
  const router = useRouter()
  const [busca, setBusca] = useState('')
  const [valores, setValores] = useState<Record<string, string>>({})
  const [lider, setLider] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
  const [ocupado, iniciar] = useTransition()

  const contados = useMemo(
    () => Object.fromEntries(p.itensContados.map((i) => [i.item_id, Number(i.quantidade)])),
    [p.itensContados],
  )

  const finalizada = p.contagem?.situacao === 'FINALIZADA'

  // Item com saldo no pulmão é obrigatório: zerar por omissão inventaria uma
  // saída que ninguém contou. O banco recusa, então avisamos antes.
  const comSaldo = Object.entries(p.saldoPulmao)
    .filter(([, q]) => q > 0)
    .map(([id]) => id)
  const faltando = comSaldo.filter(
    (id) => contados[id] === undefined && !(valores[id]?.trim()),
  )

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    const base = p.itens.filter((i) => !termo || i.nome.toLowerCase().includes(termo))
    // Itens com saldo primeiro: são os que precisam ser contados.
    return base.sort((a, b) => {
      const sa = (p.saldoPulmao[a.id] ?? 0) > 0 ? 0 : 1
      const sb = (p.saldoPulmao[b.id] ?? 0) > 0 ? 0 : 1
      return sa - sb || a.nome.localeCompare(b.nome)
    })
  }, [busca, p.itens, p.saldoPulmao])

  function trocarSetor(id: string) {
    router.push(`/contagem?setor=${id}&ciclo=${p.ciclo}`)
  }

  async function garantirContagem(): Promise<string | null> {
    if (p.contagem) return p.contagem.id
    const r = await abrirContagem(p.setorId, p.ciclo)
    if (!r.ok) {
      setMsg({ ok: false, texto: r.erro })
      return null
    }
    return (r.dados as string) ?? null
  }

  function salvar() {
    iniciar(async () => {
      const id = await garantirContagem()
      if (!id) return

      const pares = Object.entries(valores).filter(([, v]) => v.trim() !== '')
      for (const [itemId, v] of pares) {
        const q = Number(v.replace(',', '.'))
        if (!Number.isFinite(q) || q < 0) continue
        const r = await lancarContagemItem(id, itemId, q)
        if (!r.ok) {
          setMsg({ ok: false, texto: r.erro })
          return
        }
      }
      setValores({})
      setMsg({ ok: true, texto: `${pares.length} item(ns) lançado(s).` })
      router.refresh()
    })
  }

  function finalizar() {
    if (!p.contagem || !lider) return
    iniciar(async () => {
      const r = await finalizarContagem(p.contagem!.id, lider)
      if (!r.ok) {
        setMsg({ ok: false, texto: r.erro })
        return
      }
      const d = r.dados as {
        saidas_nao_discriminadas: number
        divergencias_abertas: number
      }
      setMsg({
        ok: true,
        texto:
          `Contagem finalizada. ${d.saidas_nao_discriminadas} saída(s) operacional(is) não discriminada(s)` +
          (d.divergencias_abertas
            ? ` e ${d.divergencias_abertas} divergência(s) aberta(s) por contagem acima do esperado.`
            : ', nenhuma divergência.'),
      })
      router.refresh()
    })
  }

  return (
    <div className="space-y-5">
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
          Ciclo de referência: <strong>{p.ciclo}</strong>
          {p.contagem && ` · situação: ${finalizada ? 'finalizada' : 'em preenchimento'}`}
        </p>
      </section>

      {finalizada ? (
        <section className="cartao p-4">
          <h2 className="text-sm font-semibold text-positivo">
            Contagem deste ciclo já finalizada
          </h2>
          <p className="mt-2 text-sm text-tinta-fraca">
            O pulmão foi fechado e o abastecimento já pode ser preparado. Para
            contar de novo, abra o ciclo seguinte.
          </p>
          <ul className="mt-3 divide-y divide-borda text-sm">
            {p.itensContados.map((i) => {
              const item = p.itens.find((x) => x.id === i.item_id)
              return (
                <li key={i.item_id} className="flex justify-between gap-3 py-2">
                  <span className="truncate">{item?.nome ?? i.item_id}</span>
                  <span className="tabular-nums text-tinta-fraca">
                    {fmt(Number(i.quantidade))} {item?.unidade_contagem}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      ) : (
        <>
          <section className="cartao p-4">
            <label className="rotulo" htmlFor="busca">
              Itens
            </label>
            <input
              id="busca"
              type="search"
              className="campo"
              placeholder="Filtrar por nome…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />

            <ul className="mt-3 max-h-[26rem] divide-y divide-borda overflow-auto rounded-lg border border-borda">
              {visiveis.map((i) => {
                const saldo = p.saldoPulmao[i.id] ?? 0
                const jaContado = contados[i.id]
                return (
                  <li key={i.id} className="flex items-center gap-3 px-3 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {i.nome}
                        {saldo > 0 && (
                          <span className="ml-2 rounded bg-alerta/15 px-1.5 py-0.5 text-[10px] font-semibold text-alerta">
                            obrigatório
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-xs text-tinta-fraca">
                        {i.orientacao_contagem ?? `contar em ${i.unidade_contagem}`}
                        {saldo > 0 && ` · sistema espera ${fmt(saldo)}`}
                        {jaContado !== undefined && (
                          <span className="text-positivo">
                            {' · '}lançado: {fmt(jaContado)}
                          </span>
                        )}
                      </span>
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min="0"
                      aria-label={`Contagem de ${i.nome}`}
                      className="campo w-28 shrink-0"
                      placeholder={jaContado !== undefined ? String(jaContado) : ''}
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

          <button
            type="button"
            onClick={salvar}
            className="botao-neutro w-full"
            disabled={ocupado || Object.values(valores).every((v) => !v.trim())}
          >
            {ocupado ? 'Salvando…' : 'Salvar contagem'}
          </button>

          <section className="cartao space-y-3 p-4">
            <h2 className="text-sm font-semibold">Finalizar</h2>
            <p className="text-sm text-tinta-fraca">
              Auxiliar pode preencher; quem <strong>valida e responde</strong>{' '}
              pela contagem é o líder. Finalizar fecha o ciclo do pulmão.
            </p>

            {faltando.length > 0 && (
              <p className="rounded-lg bg-alerta/10 px-3 py-2 text-sm text-alerta">
                {faltando.length} item(ns) com saldo no pulmão ainda sem
                contagem. Não dá para finalizar sem contá-los — omitir
                inventaria uma saída que ninguém verificou.
              </p>
            )}

            <div>
              <label className="rotulo" htmlFor="lider">
                Líder responsável
              </label>
              <select
                id="lider"
                className="campo"
                value={lider}
                onChange={(e) => setLider(e.target.value)}
                disabled={!p.podeFinalizar}
              >
                <option value="">Escolha…</option>
                {p.lideres.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nome}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={finalizar}
              className="botao w-full"
              disabled={
                ocupado ||
                !p.podeFinalizar ||
                !p.contagem ||
                !lider ||
                faltando.length > 0
              }
            >
              {p.podeFinalizar
                ? 'Finalizar contagem do pulmão'
                : 'Só o líder finaliza'}
            </button>
          </section>
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
    </div>
  )
}
