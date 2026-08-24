import {
  carregarSaldos,
  listarItens,
  listarLocais,
  minimosDoPulmao,
  type Item,
} from '@/lib/estoque'

/**
 * A fila de itens a contar num pulmão.
 *
 * Passar os 87 itens do catálogo um por um seria pior que a lista de campos
 * pequenos que existia antes. A fila é a UNIÃO de dois conjuntos:
 *
 *   - itens com mínimo do pulmão definido para o setor — é o que aquele
 *     pulmão carrega por decisão do CPD;
 *   - itens com saldo no pulmão — porque a finalização recusa deixar de fora
 *     item que tem saldo, e o contador precisa poder chegar até ele.
 *
 * A união é montada NO SERVIDOR e devolvida ordenada por nome, sem
 * quantidade e sem marcar de qual conjunto cada item veio. Quem conta não
 * consegue distinguir "tem saldo" de "tem mínimo", então a contagem continua
 * cega — o que se protege é o número, não a existência do item.
 *
 * `resto` é o catálogo que sobrou, para o caso de haver no pulmão algo que
 * ninguém previu. Sem essa saída, a tela seria mais rápida e menos verdadeira.
 */
export async function filaDeContagem(unidadeId: string, setorId: string) {
  const [itens, locais, saldos, minimos] = await Promise.all([
    listarItens(unidadeId),
    listarLocais(unidadeId),
    carregarSaldos(unidadeId),
    minimosDoPulmao(unidadeId, setorId),
  ])

  const pulmao = locais.find(
    (l) => l.tipo === 'PULMAO' && l.setor_id === setorId,
  )
  const saldoPulmao = pulmao ? (saldos[pulmao.id] ?? {}) : {}

  const naFila = new Set<string>(Object.keys(minimos))
  for (const [itemId, q] of Object.entries(saldoPulmao)) {
    if (q > 0) naFila.add(itemId)
  }

  const fila: Item[] = itens.filter((i) => naFila.has(i.id))
  const resto: Item[] = itens.filter((i) => !naFila.has(i.id))

  // Pulmão novo, sem mínimo e sem saldo: a fila seria vazia e a tela
  // inútil. Nesse caso o catálogo inteiro é a fila.
  return fila.length ? { fila, resto } : { fila: resto, resto: [] }
}
