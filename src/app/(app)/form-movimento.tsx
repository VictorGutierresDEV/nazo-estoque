'use client'

import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import type { Resultado } from '@/lib/acoes'
import { moeda, quantidade as fmtQtd } from '@/lib/formato'

type Produto = {
  id: string
  nome: string
  categoria: string | null
  unidade_medida: string
  custo_medio: number
}

type Praca = { id: string; nome: string }
type Colaborador = {
  id: string
  nome_completo: string
  cargo: string | null
  setor: string | null
}

type Props = {
  modo: 'SAIDA' | 'ENTRADA'
  produtos: Produto[]
  saldoCentral: Record<string, number>
  pracas?: Praca[]
  colaboradores?: Colaborador[]
  acao: (anterior: Resultado | null, dados: FormData) => Promise<Resultado>
}

export function FormMovimento({
  modo,
  produtos,
  saldoCentral,
  pracas = [],
  colaboradores = [],
  acao,
}: Props) {
  const ehSaida = modo === 'SAIDA'

  const [estado, enviar, enviando] = useActionState(acao, null)
  const [busca, setBusca] = useState('')
  const [escolhidos, setEscolhidos] = useState<string[]>([])
  const [pracaId, setPracaId] = useState('')
  const formRef = useRef<HTMLFormElement>(null)

  const porId = useMemo(
    () => new Map(produtos.map((p) => [p.id, p])),
    [produtos],
  )

  const resultados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return []
    return produtos
      .filter(
        (p) =>
          !escolhidos.includes(p.id) && p.nome.toLowerCase().includes(termo),
      )
      .slice(0, 8)
  }, [busca, produtos, escolhidos])

  // Deu certo: limpa a tela para o próximo atendimento, sem recarregar.
  // Em efeito, não no render — limpar durante o render remonta o componente
  // em loop.
  useEffect(() => {
    if (!estado?.ok) return
    setEscolhidos([])
    setBusca('')
    setPracaId('')
    formRef.current?.reset()
  }, [estado])

  function adicionar(id: string) {
    setEscolhidos((atual) => [...atual, id])
    setBusca('')
  }

  function remover(id: string) {
    setEscolhidos((atual) => atual.filter((x) => x !== id))
  }

  const porSetor = useMemo(() => {
    const mapa = new Map<string, Colaborador[]>()
    for (const c of colaboradores) {
      const chave = c.setor?.trim() || 'Sem setor'
      if (!mapa.has(chave)) mapa.set(chave, [])
      mapa.get(chave)!.push(c)
    }
    return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [colaboradores])

  return (
    <form ref={formRef} action={enviar} className="space-y-6">
      {ehSaida && (
        <>
          <section className="cartao p-4">
            <h2 className="rotulo">Para qual praça vai</h2>
            {pracas.length === 0 ? (
              <p className="text-sm text-tinta-fraca">
                Nenhuma praça cadastrada ainda. Cadastre em{' '}
                <strong>Praças</strong> antes de registrar saída.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {pracas.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPracaId(p.id)}
                    aria-pressed={pracaId === p.id}
                    className={`min-h-12 rounded-lg border px-4 text-base font-medium transition ${
                      pracaId === p.id
                        ? 'border-acento bg-acento text-white'
                        : 'border-borda bg-cartao hover:border-acento'
                    }`}
                  >
                    {p.nome}
                  </button>
                ))}
              </div>
            )}
            <input type="hidden" name="praca_id" value={pracaId} />
          </section>

          <section className="cartao p-4">
            <label className="rotulo" htmlFor="retirado_por">
              Quem está retirando
            </label>
            <select
              id="retirado_por"
              name="retirado_por"
              required
              className="campo"
              defaultValue=""
            >
              <option value="" disabled>
                Escolha a pessoa…
              </option>
              {porSetor.map(([setor, pessoas]) => (
                <optgroup key={setor} label={setor}>
                  {pessoas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome_completo}
                      {c.cargo ? ` — ${c.cargo}` : ''}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <p className="mt-2 text-xs text-tinta-fraca">
              A lista vem do cadastro de colaboradores do Nazo. Sem escolher
              uma pessoa, o banco recusa a saída.
            </p>
          </section>
        </>
      )}

      {!ehSaida && (
        <section className="cartao grid gap-4 p-4 sm:grid-cols-2">
          <div>
            <label className="rotulo" htmlFor="fornecedor">
              Fornecedor / origem
            </label>
            <input
              id="fornecedor"
              name="fornecedor"
              className="campo"
              placeholder="Ex.: CPD Matriz"
            />
          </div>
          <div>
            <label className="rotulo" htmlFor="documento">
              Nota / documento
            </label>
            <input
              id="documento"
              name="documento"
              className="campo"
              placeholder="Ex.: NF 12345"
            />
          </div>
        </section>
      )}

      <section className="cartao p-4">
        <label className="rotulo" htmlFor="busca">
          Itens
        </label>

        <input
          id="busca"
          type="search"
          className="campo"
          placeholder="Digite o nome do produto…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          autoComplete="off"
        />

        {resultados.length > 0 && (
          <ul className="mt-2 divide-y divide-borda overflow-hidden rounded-lg border border-borda">
            {resultados.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => adicionar(p.id)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left hover:bg-acento-fraco"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{p.nome}</span>
                    {p.categoria && (
                      <span className="block truncate text-xs text-tinta-fraca">
                        {p.categoria}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-sm text-tinta-fraca">
                    {fmtQtd(saldoCentral[p.id] ?? 0)} {p.unidade_medida}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {busca.trim() && resultados.length === 0 && (
          <p className="mt-2 text-sm text-tinta-fraca">
            Nenhum produto encontrado para “{busca}”.
          </p>
        )}

        {escolhidos.length === 0 ? (
          <p className="mt-4 text-sm text-tinta-fraca">
            Busque acima e toque no produto para adicionar.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {escolhidos.map((id) => {
              const p = porId.get(id)
              if (!p) return null
              const disponivel = saldoCentral[id] ?? 0
              return (
                <li
                  key={id}
                  className="rounded-lg border border-borda p-3"
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{p.nome}</p>
                      <p className="text-xs text-tinta-fraca">
                        {ehSaida
                          ? `Disponível no Central: ${fmtQtd(disponivel)} ${p.unidade_medida}`
                          : `Custo médio atual: ${moeda(p.custo_medio)}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => remover(id)}
                      className="shrink-0 text-sm text-tinta-fraca underline underline-offset-4 hover:text-acento"
                    >
                      Remover
                    </button>
                  </div>

                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label
                        className="rotulo"
                        htmlFor={`item-${id}`}
                      >
                        Quantidade ({p.unidade_medida})
                      </label>
                      <input
                        id={`item-${id}`}
                        name={`item-${id}`}
                        type="number"
                        inputMode="decimal"
                        step="any"
                        min="0"
                        required
                        autoFocus
                        className="campo"
                      />
                    </div>

                    {!ehSaida && (
                      <div className="flex-1">
                        <label className="rotulo" htmlFor={`custo-${id}`}>
                          Custo unitário (R$)
                        </label>
                        <input
                          id={`custo-${id}`}
                          name={`custo-${id}`}
                          type="number"
                          inputMode="decimal"
                          step="any"
                          min="0"
                          className="campo"
                          placeholder={String(p.custo_medio || '')}
                        />
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="cartao p-4">
        <label className="rotulo" htmlFor="observacao">
          Observação (opcional)
        </label>
        <input id="observacao" name="observacao" className="campo" />
      </section>

      {estado && !estado.ok && (
        <p className="rounded-lg border border-acento/30 bg-acento-fraco px-4 py-3 text-sm text-acento">
          {estado.erro}
        </p>
      )}

      {estado?.ok && (
        <p className="rounded-lg border border-positivo/30 bg-positivo/10 px-4 py-3 text-sm text-positivo">
          {ehSaida ? 'Saída registrada.' : 'Entrada registrada.'} O extrato já
          mostra o lançamento.
        </p>
      )}

      <button
        type="submit"
        className="botao w-full"
        disabled={
          enviando ||
          escolhidos.length === 0 ||
          (ehSaida && (!pracaId || pracas.length === 0))
        }
      >
        {enviando
          ? 'Registrando…'
          : ehSaida
            ? 'Registrar saída'
            : 'Registrar entrada'}
      </button>
    </form>
  )
}
