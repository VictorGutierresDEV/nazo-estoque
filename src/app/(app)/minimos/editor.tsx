'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  definirMinimoCasa,
  definirMinimoPulmao,
  sugerirMinimo,
} from '@/lib/operacoes'
import { quantidade as fmt } from '@/lib/formato'
import type { Item, Setor } from '@/lib/estoque'

type Props = {
  escopo: 'pulmao' | 'casa'
  setores: Setor[]
  setorId: string
  itens: Item[]
  valores: Record<string, number>
  podeDefinirPulmao: boolean
  podeDefinirCasa: boolean
  podeSugerir: boolean
}

export function EditorMinimos(p: Props) {
  const router = useRouter()
  const [busca, setBusca] = useState('')
  const [edicoes, setEdicoes] = useState<Record<string, string>>({})
  const [justificativa, setJustificativa] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
  const [ocupado, iniciar] = useTransition()

  const noPulmao = p.escopo === 'pulmao'
  const podeDefinir = noPulmao ? p.podeDefinirPulmao : p.podeDefinirCasa
  const modoSugestao = !podeDefinir && p.podeSugerir

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return p.itens.filter((i) => !termo || i.nome.toLowerCase().includes(termo))
  }, [busca, p.itens])

  const pendentes = Object.entries(edicoes).filter(([, v]) => v.trim() !== '')

  function ir(escopo: string, setor?: string) {
    const qs = new URLSearchParams({ escopo })
    if (setor) qs.set('setor', setor)
    router.push(`/minimos?${qs}`)
  }

  function gravar() {
    if (modoSugestao && !justificativa.trim()) {
      setMsg({ ok: false, texto: 'A sugestão exige motivo.' })
      return
    }
    iniciar(async () => {
      for (const [itemId, v] of pendentes) {
        const q = Number(v.replace(',', '.'))
        if (!Number.isFinite(q) || q < 0) continue

        const r = modoSugestao
          ? await sugerirMinimo(
              noPulmao ? 'MINIMO_PULMAO' : 'MINIMO_CASA',
              itemId,
              q,
              justificativa,
              noPulmao ? p.setorId : undefined,
            )
          : noPulmao
            ? await definirMinimoPulmao(p.setorId, itemId, q, justificativa)
            : await definirMinimoCasa(itemId, q, justificativa)

        if (!r.ok) {
          setMsg({ ok: false, texto: r.erro })
          return
        }
      }
      setEdicoes({})
      setMsg({
        ok: true,
        texto: modoSugestao
          ? `${pendentes.length} sugestão(ões) registrada(s) para decisão.`
          : `${pendentes.length} mínimo(s) atualizado(s).`,
      })
      router.refresh()
    })
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => ir('pulmao', p.setorId)}
          aria-pressed={noPulmao}
          className={noPulmao ? 'botao' : 'botao-neutro'}
        >
          Mínimo do pulmão
        </button>
        <button
          type="button"
          onClick={() => ir('casa')}
          aria-pressed={!noPulmao}
          className={!noPulmao ? 'botao' : 'botao-neutro'}
        >
          Mínimo da casa
        </button>
      </div>

      {noPulmao && (
        <section className="cartao p-4">
          <h2 className="rotulo">Setor</h2>
          <div className="flex flex-wrap gap-2">
            {p.setores.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => ir('pulmao', s.id)}
                aria-pressed={s.id === p.setorId}
                className={`min-h-12 rounded-lg border px-4 font-medium transition ${
                  s.id === p.setorId
                    ? 'border-acento bg-acento text-white'
                    : 'border-borda bg-cartao hover:border-acento'
                }`}
              >
                {s.nome}
              </button>
            ))}
          </div>
        </section>
      )}

      {modoSugestao && (
        <p className="rounded-lg border border-alerta/30 bg-alerta/10 px-4 py-3 text-sm">
          Seu perfil <strong>sugere</strong> alteração; quem define é a direção
          ou o Gerente de CPD. Sua sugestão fica registrada com motivo, para
          decisão.
        </p>
      )}

      <section className="cartao p-4">
        <label className="rotulo" htmlFor="busca">
          Itens ({Object.keys(p.valores).length} com mínimo definido)
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
          {visiveis.map((i) => (
            <li key={i.id} className="flex items-center gap-3 px-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {i.nome}
                </span>
                <span className="block truncate text-xs text-tinta-fraca">
                  {i.unidade_contagem}
                  {p.valores[i.id] !== undefined &&
                    ` · atual: ${fmt(p.valores[i.id])}`}
                </span>
              </span>
              <input
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                aria-label={`Mínimo de ${i.nome}`}
                className="campo w-28 shrink-0"
                placeholder={
                  p.valores[i.id] !== undefined ? String(p.valores[i.id]) : '0'
                }
                value={edicoes[i.id] ?? ''}
                onChange={(e) =>
                  setEdicoes((v) => ({ ...v, [i.id]: e.target.value }))
                }
                disabled={!podeDefinir && !modoSugestao}
              />
            </li>
          ))}
        </ul>
      </section>

      <section className="cartao p-4">
        <label className="rotulo" htmlFor="just">
          {modoSugestao ? 'Motivo da sugestão *' : 'Justificativa (fica no histórico)'}
        </label>
        <input
          id="just"
          className="campo"
          value={justificativa}
          onChange={(e) => setJustificativa(e.target.value)}
        />
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
        disabled={
          ocupado ||
          pendentes.length === 0 ||
          (!podeDefinir && !modoSugestao)
        }
      >
        {ocupado
          ? 'Gravando…'
          : modoSugestao
            ? `Sugerir ${pendentes.length} alteração(ões)`
            : `Salvar ${pendentes.length} mínimo(s)`}
      </button>
    </div>
  )
}
