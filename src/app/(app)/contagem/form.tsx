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
  contagem: Contagem
  itensContados: ContagemItem[]
  lideres: { id: string; nome: string; funcao: string }[]
  podeFinalizar: boolean
}

/**
 * Contagem CEGA.
 *
 * Durante o preenchimento a tela não mostra — e o servidor não envia — o saldo
 * que o sistema espera encontrar. Ver o esperado enviesa: a tendência é repetir
 * o número em vez de contar. O confronto Contado x Esperado x Diferença aparece
 * só depois da finalização, quando já não pode influenciar a contagem.
 */
export function FormContagem(p: Props) {
  const router = useRouter()
  const [busca, setBusca] = useState('')
  const [valores, setValores] = useState<Record<string, string>>({})
  const [lider, setLider] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
  const [ocupado, iniciar] = useTransition()

  const contados = useMemo(
    () =>
      Object.fromEntries(
        p.itensContados.map((i) => [i.item_id, Number(i.quantidade)]),
      ),
    [p.itensContados],
  )

  const finalizada = p.contagem?.situacao === 'FINALIZADA'

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return p.itens.filter((i) => !termo || i.nome.toLowerCase().includes(termo))
  }, [busca, p.itens])

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
      setMsg({
        ok: true,
        texto: `${pares.length} item(ns) lançado(s). Corrigir antes de finalizar é permitido — a alteração fica na trilha.`,
      })
      router.refresh()
    })
  }

  function finalizar() {
    if (!p.contagem || !lider) return
    iniciar(async () => {
      const r = await finalizarContagem(p.contagem!.id, lider)
      if (!r.ok) {
        // Quando falta contar item com saldo, a mensagem do banco lista quais
        // são — é aqui que o operador descobre, e sem ver quantidade.
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
        Ciclo de referência: <strong>{p.ciclo}</strong>
        {p.contagem &&
          ` · ${finalizada ? 'finalizada' : 'em preenchimento'}`}
      </p>
    </section>
  )

  if (finalizada) {
    const linhas = p.itensContados
      .map((i) => {
        const item = p.itens.find((x) => x.id === i.item_id)
        const contado = Number(i.quantidade)
        const esperado =
          i.quantidade_esperada === null ? null : Number(i.quantidade_esperada)
        return {
          nome: item?.nome ?? i.item_id,
          unidade: item?.unidade_contagem ?? '',
          contado,
          esperado,
          diferenca: esperado === null ? null : contado - esperado,
        }
      })
      .sort(
        (a, b) =>
          Math.abs(b.diferenca ?? 0) - Math.abs(a.diferenca ?? 0) ||
          a.nome.localeCompare(b.nome),
      )

    return (
      <div className="space-y-5">
        {abas}
        <section className="cartao overflow-hidden">
          <h2 className="border-b border-borda px-4 py-3 text-sm font-semibold text-positivo">
            Contagem finalizada — confronto
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-sm">
              <thead>
                <tr className="border-b border-borda text-left text-tinta-fraca">
                  <th className="px-4 py-2 font-medium">Item</th>
                  <th className="px-3 py-2 text-right font-medium">Contado</th>
                  <th className="px-3 py-2 text-right font-medium">Esperado</th>
                  <th className="px-3 py-2 text-right font-medium">Diferença</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borda">
                {linhas.map((l) => (
                  <tr key={l.nome}>
                    <td className="px-4 py-2">
                      {l.nome}
                      <span className="ml-1.5 text-xs text-tinta-fraca">
                        {l.unidade}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {fmt(l.contado)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-tinta-fraca">
                      {l.esperado === null ? '—' : fmt(l.esperado)}
                    </td>
                    <td
                      className={`px-3 py-2 text-right tabular-nums ${
                        l.diferenca === null || l.diferenca === 0
                          ? 'text-tinta-fraca'
                          : l.diferenca > 0
                            ? 'font-semibold text-alerta'
                            : ''
                      }`}
                    >
                      {l.diferenca === null
                        ? '—'
                        : l.diferenca > 0
                          ? `+${fmt(l.diferenca)}`
                          : fmt(l.diferenca)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-borda px-4 py-2 text-xs text-tinta-fraca">
            Diferença negativa fechou o ciclo como saída operacional não
            discriminada — é o consumo normal indo para a praça, não perda.
            Diferença positiva abriu divergência para apuração.
          </p>
        </section>
        {msg && <Aviso msg={msg} />}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {abas}

      <p className="rounded-lg border border-borda bg-cartao px-4 py-3 text-sm text-tinta-fraca">
        Conte o que existe fisicamente no pulmão. A tela não mostra o que o
        sistema espera encontrar — o confronto aparece depois de finalizar.
      </p>

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
            const jaContado = contados[i.id]
            return (
              <li key={i.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {i.nome}
                  </span>
                  <span className="block truncate text-xs text-tinta-fraca">
                    {i.orientacao_contagem ?? `contar em ${i.unidade_contagem}`}
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
          Auxiliar pode preencher; quem <strong>valida e responde</strong> pela
          contagem é o líder. Se faltar contar algum item que tem saldo, o
          sistema recusa e diz quais são.
        </p>

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
          disabled={ocupado || !p.podeFinalizar || !p.contagem || !lider}
        >
          {p.podeFinalizar
            ? 'Finalizar contagem do pulmão'
            : 'Só o líder finaliza'}
        </button>
      </section>

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
