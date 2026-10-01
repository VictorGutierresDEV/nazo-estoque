import {
  MENSAGEM_SEM_SETOR_VISIVEL,
  MENSAGEM_SETOR_FORA_DO_ACESSO,
} from '@/lib/acesso-leitura-nucleo'

/**
 * Avisos da leitura por setor (v57). Só aparecem no modo v57: no legado as
 * telas seguem como antes.
 */

export function SemSetorVisivel() {
  return (
    <div className="cartao p-6">
      <h1 className="text-lg font-bold">Nenhum setor visível</h1>
      <p className="mt-2 text-sm text-tinta-fraca">{MENSAGEM_SEM_SETOR_VISIVEL}</p>
    </div>
  )
}

export function AvisoForaDoAcesso() {
  return (
    <p
      role="status"
      className="mb-4 rounded-lg border border-alerta/30 bg-alerta/10 px-4 py-3 text-sm"
    >
      {MENSAGEM_SETOR_FORA_DO_ACESSO}
    </p>
  )
}
