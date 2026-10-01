import {
  carregarSaldos,
  listarItens,
  listarLocais,
  minimosDoPulmao,
  type Item,
} from '@/lib/estoque'
import {
  acessoDeLeitura,
  itensComSaldoNoPulmao,
  leituraRestrita,
} from '@/lib/acesso-leitura'

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
 * Com a v57, fora da gestão, a visão de saldos chega vazia: os itens com
 * saldo vêm de `estoque_d4_itens_com_saldo_pulmao`, que já responde sem
 * quantidade. Gestão e modo legado leem os saldos como antes.
 *
 * `resto` é o catálogo que sobrou, para o caso de haver no pulmão algo que
 * ninguém previu. Sem essa saída, a tela seria mais rápida e menos verdadeira.
 */
export async function filaDeContagem(unidadeId: string, setorId: string) {
  const [itens, minimos, comSaldo] = await Promise.all([
    listarItens(unidadeId),
    minimosDoPulmao(unidadeId, setorId),
    itensComSaldo(unidadeId, setorId),
  ])

  const naFila = new Set<string>([...Object.keys(minimos), ...comSaldo])

  const fila: Item[] = itens.filter((i) => naFila.has(i.id))
  const resto: Item[] = itens.filter((i) => !naFila.has(i.id))

  // Pulmão novo, sem mínimo e sem saldo: a fila seria vazia e a tela
  // inútil. Nesse caso o catálogo inteiro é a fila.
  return fila.length ? { fila, resto } : { fila: resto, resto: [] }
}

/** Itens com saldo > 0 no pulmão do setor, sem quantidade. */
async function itensComSaldo(
  unidadeId: string,
  setorId: string,
): Promise<string[]> {
  if (leituraRestrita(await acessoDeLeitura(unidadeId))) {
    const ids = await itensComSaldoNoPulmao(setorId)
    if (ids !== null) return ids
  }

  const [locais, saldos] = await Promise.all([
    listarLocais(unidadeId),
    carregarSaldos(unidadeId),
  ])
  const pulmao = locais.find(
    (l) => l.tipo === 'PULMAO' && l.setor_id === setorId,
  )
  const saldoPulmao = pulmao ? (saldos[pulmao.id] ?? {}) : {}
  return Object.entries(saldoPulmao)
    .filter(([, q]) => q > 0)
    .map(([itemId]) => itemId)
}
