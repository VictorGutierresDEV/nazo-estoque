'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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
  fila: Item[]
  resto: Item[]
  contagem: Contagem
  itensContados: ContagemItem[]
  lideres: { id: string; nome: string; funcao: string }[]
  podeFinalizar: boolean
}

/**
 * Contagem CEGA, um item por vez.
 *
 * Em pé, com a mão ocupada, digitar num campo de 14px é o que fazia a
 * contagem ser feita "de cabeça" e conferida depois. Aqui é um item por tela,
 * número grande e teclado próprio — o dedo não precisa de precisão.
 *
 * O esperado não aparece e não chega ao navegador: ver o número que o sistema
 * espera enviesa, a tendência é repetir em vez de contar. O confronto
 * Contado x Esperado x Diferença só aparece depois de finalizar.
 */
export function FormContagem(p: Props) {
  const router = useRouter()
  const [modo, setModo] = useState<'teclado' | 'lista'>('teclado')
  const [extras, setExtras] = useState<Item[]>([])
  const [indice, setIndice] = useState(0)
  const [valor, setValor] = useState('')
  const [busca, setBusca] = useState('')
  const [lider, setLider] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
  const [ocupado, iniciar] = useTransition()

  const lista = useMemo(() => [...p.fila, ...extras], [p.fila, extras])
  const contados = useMemo(
    () =>
      new Map(
        p.itensContados.map((i) => [i.item_id, Number(i.quantidade)]),
      ),
    [p.itensContados],
  )

  const finalizada = p.contagem?.situacao === 'FINALIZADA'
  const item = lista[indice]
  const faltam = lista.filter((i) => !contados.has(i.id)).length

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

  function tecla(t: string) {
    setMsg(null)
    if (t === 'apaga') return setValor((v) => v.slice(0, -1))
    if (t === ',') return setValor((v) => (v.includes(',') ? v : (v || '0') + ','))
    setValor((v) => (v === '0' ? t : (v + t).slice(0, 9)))
  }

  function salvar(qtd: number) {
    iniciar(async () => {
      const id = await garantirContagem()
      if (!id || !item) return
      const r = await lancarContagemItem(id, item.id, qtd)
      if (!r.ok) return setMsg({ ok: false, texto: r.erro })
      setValor('')
      setIndice((i) => Math.min(i + 1, lista.length - 1))
      router.refresh()
    })
  }

  // ------------------------------------------------------------ finalizada
  if (finalizada) {
    const linhas = p.itensContados
      .map((i) => {
        const it = [...p.fila, ...p.resto].find((x) => x.id === i.item_id)
        const contado = Number(i.quantidade)
        const esperado =
          i.quantidade_esperada === null ? null : Number(i.quantidade_esperada)
        return {
          nome: it?.nome ?? i.item_id,
          unidade: it?.unidade_contagem ?? '',
          contado,
          esperado,
          dif: esperado === null ? null : contado - esperado,
        }
      })
      .sort(
        (a, b) =>
          Math.abs(b.dif ?? 0) - Math.abs(a.dif ?? 0) ||
          a.nome.localeCompare(b.nome),
      )

    return (
      <div className="space-y-5">
        <Cabecalho setores={p.setores} setorId={p.setorId} ciclo={p.ciclo} onTrocar={trocarSetor} />
        <section className="cartao overflow-hidden">
          <h2 className="border-b border-borda px-4 py-3 text-sm font-semibold text-positivo">
            Contagem finalizada — confronto
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[26rem] text-sm">
              <thead>
                <tr className="border-b border-borda text-left text-tinta-fraca">
                  <th className="px-4 py-2 font-medium">Item</th>
                  <th className="px-3 py-2 text-right font-medium">Contado</th>
                  <th className="px-3 py-2 text-right font-medium">Esperado</th>
                  <th className="px-3 py-2 text-right font-medium">Dif.</th>
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
                    <td className="px-3 py-2 text-right font-medium tabular-nums">
                      {fmt(l.contado)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-tinta-fraca">
                      {l.esperado === null ? '—' : fmt(l.esperado)}
                    </td>
                    <td
                      className={`px-3 py-2 text-right tabular-nums ${
                        !l.dif ? 'text-tinta-fraca' : l.dif > 0 ? 'font-semibold text-alerta' : ''
                      }`}
                    >
                      {l.dif === null ? '—' : l.dif > 0 ? `+${fmt(l.dif)}` : fmt(l.dif)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-borda px-4 py-2.5 text-xs leading-relaxed text-tinta-fraca">
            Diferença negativa fechou o ciclo como saída operacional não
            discriminada — é o consumo normal indo para a praça, não perda.
            Positiva abriu divergência para apuração.
          </p>
        </section>
        <Link href="/" className="botao-neutro w-full">
          Voltar ao painel
        </Link>
      </div>
    )
  }

  // --------------------------------------------------------------- lista
  if (modo === 'lista') {
    const visiveis = busca.trim()
      ? p.resto.filter((i) =>
          i.nome.toLowerCase().includes(busca.trim().toLowerCase()),
        )
      : []
    return (
      <div className="space-y-4">
        <Cabecalho setores={p.setores} setorId={p.setorId} ciclo={p.ciclo} onTrocar={trocarSetor} />

        <section className="cartao overflow-hidden">
          <h2 className="border-b border-borda px-4 py-3 text-sm font-semibold">
            {lista.length} itens · {faltam} sem contagem
          </h2>
          <ul className="max-h-[24rem] divide-y divide-borda overflow-auto">
            {lista.map((i, n) => {
              const q = contados.get(i.id)
              return (
                <li key={i.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setIndice(n)
                      setValor('')
                      setModo('teclado')
                    }}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-acento-fraco"
                  >
                    <span className="min-w-0 truncate text-sm font-medium">
                      {i.nome}
                    </span>
                    <span
                      className={`shrink-0 text-sm tabular-nums ${
                        q === undefined ? 'text-tinta-fraca' : 'font-semibold text-positivo'
                      }`}
                    >
                      {q === undefined ? 'contar' : fmt(q)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>

        <section className="cartao p-4">
          <label className="rotulo" htmlFor="busca">
            Achou algo no pulmão que não está na lista?
          </label>
          <input
            id="busca"
            type="search"
            className="campo"
            placeholder="Buscar no catálogo…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          {visiveis.length > 0 && (
            <ul className="mt-2 max-h-56 divide-y divide-borda overflow-auto rounded-lg border border-borda">
              {visiveis.slice(0, 20).map((i) => (
                <li key={i.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setExtras((e) => [...e, i])
                      setIndice(lista.length)
                      setValor('')
                      setBusca('')
                      setModo('teclado')
                    }}
                    className="w-full px-3 py-3 text-left text-sm hover:bg-acento-fraco"
                  >
                    {i.nome}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <button type="button" className="botao w-full" onClick={() => setModo('teclado')}>
          Continuar contando
        </button>

        <Finalizar
          {...p}
          lider={lider}
          setLider={setLider}
          faltam={faltam}
          ocupado={ocupado}
          onFinalizar={(id, l) =>
            iniciar(async () => {
              const r = await finalizarContagem(id, l)
              if (!r.ok) return setMsg({ ok: false, texto: r.erro })
              const d = r.dados as {
                saidas_nao_discriminadas: number
                divergencias_abertas: number
              }
              setMsg({
                ok: true,
                texto: `Contagem finalizada. ${d.saidas_nao_discriminadas} saída(s) não discriminada(s)${
                  d.divergencias_abertas
                    ? ` e ${d.divergencias_abertas} divergência(s) aberta(s).`
                    : ', nenhuma divergência.'
                }`,
              })
              router.refresh()
            })
          }
        />
        {msg && <Aviso msg={msg} />}
      </div>
    )
  }

  // ------------------------------------------------------------- teclado
  if (!item) {
    return (
      <div className="cartao p-6">
        <h1 className="text-lg font-bold">Nada a contar neste setor</h1>
        <p className="mt-2 text-sm text-tinta-fraca">
          Este pulmão não tem mínimo definido nem saldo. Defina os mínimos em{' '}
          <Link href="/minimos" className="text-acento underline underline-offset-4">
            Mínimos
          </Link>{' '}
          para a contagem ter uma fila.
        </p>
      </div>
    )
  }

  const jaContado = contados.get(item.id)

  return (
    <div className="flex flex-col gap-4">
      <Cabecalho setores={p.setores} setorId={p.setorId} ciclo={p.ciclo} onTrocar={trocarSetor} />

      {/* progresso */}
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-borda">
          <div
            className="h-full rounded-full bg-acento transition-all"
            style={{ width: `${((indice + 1) / lista.length) * 100}%` }}
          />
        </div>
        <button
          type="button"
          onClick={() => setModo('lista')}
          className="shrink-0 text-sm font-medium tabular-nums text-tinta-fraca underline underline-offset-4"
        >
          {indice + 1}/{lista.length}
        </button>
      </div>

      {/* item */}
      <div className="text-center">
        <h1 className="text-2xl font-bold leading-tight tracking-tight text-balance">
          {item.nome}
        </h1>
        <p className="mt-2.5 inline-flex items-center gap-2 rounded-lg bg-acento-fraco px-3 py-1.5 text-sm font-medium text-acento">
          {item.orientacao_contagem ?? `conte em ${item.unidade_contagem}`}
        </p>
        {jaContado !== undefined && (
          <p className="mt-2 text-xs text-positivo">
            já lançado: {fmt(jaContado)} · digitar de novo substitui e fica na
            trilha
          </p>
        )}
      </div>

      {/* valor */}
      <div className="py-1 text-center">
        <span className="text-6xl font-bold leading-none tabular-nums tracking-tighter">
          {valor === '' ? (
            <span className="text-borda">0</span>
          ) : (
            valor.replace('.', ',')
          )}
        </span>
        <p className="mt-1.5 text-sm text-tinta-fraca">{item.unidade_contagem}</p>
      </div>

      {/* teclado */}
      <div className="grid grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0'].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => tecla(t)}
            className="min-h-14 rounded-xl border border-borda bg-cartao text-2xl font-semibold text-tinta transition active:bg-papel"
          >
            {t}
          </button>
        ))}
        <button
          type="button"
          onClick={() => tecla('apaga')}
          aria-label="Apagar"
          className="flex min-h-14 items-center justify-center rounded-xl border border-borda bg-cartao text-tinta-fraca transition active:bg-papel"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 6H9l-5 6 5 6h11a1 1 0 001-1V7a1 1 0 00-1-1z" />
            <path d="M17 10l-4 4M13 10l4 4" />
          </svg>
        </button>
      </div>

      {/* ações */}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={ocupado}
          onClick={() => salvar(0)}
          className="botao-neutro min-w-24"
        >
          Zero
        </button>
        <button
          type="button"
          disabled={ocupado || valor === ''}
          onClick={() => {
            const q = Number(valor.replace(',', '.'))
            if (Number.isFinite(q) && q >= 0) salvar(q)
          }}
          className="botao flex-1"
        >
          {ocupado ? 'Salvando…' : 'Salvar e seguir'}
        </button>
      </div>

      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          disabled={indice === 0}
          onClick={() => {
            setIndice((i) => Math.max(0, i - 1))
            setValor('')
          }}
          className="text-tinta-fraca underline underline-offset-4 disabled:opacity-40"
        >
          ‹ anterior
        </button>
        <span className="text-tinta-fraca">
          {faltam === 0 ? 'tudo contado' : `${faltam} sem contagem`}
        </span>
        <button
          type="button"
          disabled={indice >= lista.length - 1}
          onClick={() => {
            setIndice((i) => Math.min(lista.length - 1, i + 1))
            setValor('')
          }}
          className="text-tinta-fraca underline underline-offset-4 disabled:opacity-40"
        >
          próximo ›
        </button>
      </div>

      {msg && <Aviso msg={msg} />}

      {faltam === 0 && (
        <Finalizar
          {...p}
          lider={lider}
          setLider={setLider}
          faltam={faltam}
          ocupado={ocupado}
          onFinalizar={(id, l) =>
            iniciar(async () => {
              const r = await finalizarContagem(id, l)
              if (!r.ok) return setMsg({ ok: false, texto: r.erro })
              router.refresh()
            })
          }
        />
      )}
    </div>
  )
}

function Cabecalho({
  setores,
  setorId,
  ciclo,
  onTrocar,
}: {
  setores: Setor[]
  setorId: string
  ciclo: string
  onTrocar: (id: string) => void
}) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
      {setores.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onTrocar(s.id)}
          aria-pressed={s.id === setorId}
          className={`min-h-10 shrink-0 rounded-lg border px-3.5 text-sm font-medium transition ${
            s.id === setorId
              ? 'border-acento bg-acento text-white'
              : 'border-borda bg-cartao text-tinta-fraca'
          }`}
        >
          {s.nome}
        </button>
      ))}
      <span className="shrink-0 pl-1 text-xs text-tinta-fraca">{ciclo}</span>
    </div>
  )
}

function Finalizar({
  contagem,
  lideres,
  podeFinalizar,
  lider,
  setLider,
  faltam,
  ocupado,
  onFinalizar,
}: Props & {
  lider: string
  setLider: (v: string) => void
  faltam: number
  ocupado: boolean
  onFinalizar: (contagemId: string, lider: string) => void
}) {
  return (
    <section className="cartao space-y-3 p-4">
      <h2 className="text-sm font-semibold">Finalizar</h2>
      <p className="text-sm leading-relaxed text-tinta-fraca">
        Auxiliar pode preencher; quem <strong>valida e responde</strong> pela
        contagem é o líder. Se faltar item com saldo, o sistema recusa e diz
        quais são.
      </p>
      {faltam > 0 && (
        <p className="rounded-lg bg-alerta/10 px-3 py-2 text-sm text-alerta">
          {faltam} item(ns) da fila ainda sem contagem.
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
          disabled={!podeFinalizar}
        >
          <option value="">Escolha…</option>
          {lideres.map((l) => (
            <option key={l.id} value={l.id}>
              {l.nome}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        className="botao w-full"
        disabled={ocupado || !podeFinalizar || !contagem || !lider}
        onClick={() => contagem && onFinalizar(contagem.id, lider)}
      >
        {podeFinalizar ? 'Finalizar contagem do pulmão' : 'Só o líder finaliza'}
      </button>
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
