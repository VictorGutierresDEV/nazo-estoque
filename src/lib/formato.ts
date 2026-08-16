const MOEDA = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const QUANTIDADE = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
})

const DATA_HORA = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
})

export function moeda(valor: number | null | undefined) {
  return MOEDA.format(valor ?? 0)
}

export function quantidade(valor: number | null | undefined) {
  return QUANTIDADE.format(valor ?? 0)
}

export function dataHora(iso: string | null | undefined) {
  if (!iso) return '—'
  return DATA_HORA.format(new Date(iso))
}

/** "Victor Gutierres Pereira" -> "Victor Gutierres" */
export function nomeCurto(nome: string | null | undefined) {
  if (!nome) return '—'
  const partes = nome.trim().split(/\s+/)
  return partes.length <= 2 ? nome : `${partes[0]} ${partes[partes.length - 1]}`
}
