'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { criarClienteNavegador } from '@/lib/supabase/client'

export default function Login() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function entrar(evento: React.FormEvent) {
    evento.preventDefault()
    setEnviando(true)
    setErro(null)

    const supabase = criarClienteNavegador()
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    })

    if (error) {
      setErro(
        error.message === 'Invalid login credentials'
          ? 'E-mail ou senha incorretos.'
          : error.message,
      )
      setEnviando(false)
      return
    }

    router.replace('/')
    router.refresh()
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Nazo Estoque</h1>
          <p className="mt-1 text-sm text-tinta-fraca">
            Use o mesmo login do app do Nazo.
          </p>
        </div>

        <form onSubmit={entrar} className="cartao space-y-4 p-6">
          <div>
            <label className="rotulo" htmlFor="email">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              className="campo"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="rotulo" htmlFor="senha">
              Senha
            </label>
            <input
              id="senha"
              type="password"
              autoComplete="current-password"
              required
              className="campo"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
          </div>

          {erro && (
            <p className="rounded-lg bg-acento-fraco px-3 py-2 text-sm text-acento">
              {erro}
            </p>
          )}

          <button type="submit" className="botao w-full" disabled={enviando}>
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </main>
  )
}
