'use client'

import { useActionState, useEffect, useRef } from 'react'
import { salvarPraca } from '@/lib/acoes'

export function FormPraca() {
  const [estado, enviar, enviando] = useActionState(salvarPraca, null)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (estado?.ok) formRef.current?.reset()
  }, [estado])

  return (
    <form ref={formRef} action={enviar} className="cartao space-y-4 p-4">
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr]">
        <div>
          <label className="rotulo" htmlFor="nome">
            Nome da praça
          </label>
          <input
            id="nome"
            name="nome"
            required
            className="campo"
            placeholder="Ex.: Sushi"
          />
        </div>
        <div>
          <label className="rotulo" htmlFor="codigo">
            Código
          </label>
          <input
            id="codigo"
            name="codigo"
            className="campo"
            placeholder="automático"
          />
        </div>
        <div>
          <label className="rotulo" htmlFor="ordem">
            Ordem
          </label>
          <input
            id="ordem"
            name="ordem"
            type="number"
            defaultValue={0}
            className="campo"
          />
        </div>
      </div>

      {estado && !estado.ok && (
        <p className="rounded-lg bg-acento-fraco px-3 py-2 text-sm text-acento">
          {estado.erro}
        </p>
      )}

      <button type="submit" className="botao" disabled={enviando}>
        {enviando ? 'Salvando…' : 'Adicionar praça'}
      </button>
    </form>
  )
}
