'use client'

import { useActionState, useEffect, useRef } from 'react'
import { salvarProduto } from '@/lib/acoes'

const UNIDADES = ['un', 'kg', 'g', 'L', 'ml', 'cx', 'pct', 'fd']

export function FormProduto() {
  const [estado, enviar, enviando] = useActionState(salvarProduto, null)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (estado?.ok) formRef.current?.reset()
  }, [estado])

  return (
    <form ref={formRef} action={enviar} className="cartao space-y-4 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="rotulo" htmlFor="nome">
            Nome do produto
          </label>
          <input
            id="nome"
            name="nome"
            required
            className="campo"
            placeholder="Ex.: Salmão fresco"
          />
        </div>

        <div>
          <label className="rotulo" htmlFor="categoria">
            Categoria
          </label>
          <input
            id="categoria"
            name="categoria"
            className="campo"
            placeholder="Ex.: Pescados"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="rotulo" htmlFor="unidade_medida">
              Unidade
            </label>
            <select
              id="unidade_medida"
              name="unidade_medida"
              className="campo"
              defaultValue="un"
            >
              {UNIDADES.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="rotulo" htmlFor="estoque_minimo">
              Mínimo
            </label>
            <input
              id="estoque_minimo"
              name="estoque_minimo"
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              defaultValue={0}
              className="campo"
            />
          </div>
        </div>
      </div>

      {estado && !estado.ok && (
        <p className="rounded-lg bg-acento-fraco px-3 py-2 text-sm text-acento">
          {estado.erro}
        </p>
      )}

      <button type="submit" className="botao" disabled={enviando}>
        {enviando ? 'Salvando…' : 'Adicionar produto'}
      </button>
    </form>
  )
}
