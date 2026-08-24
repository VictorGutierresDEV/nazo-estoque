import { criarClienteServidor } from '@/lib/supabase/server'
import {
  carregarSaldos,
  divergenciasPendentes,
  listarItens,
  listarLocais,
  listarSetores,
  pode,
  podeNoSetor,
  type Contexto,
  type Setor,
} from '@/lib/estoque'

/**
 * "O que fazer agora": a fila de pendências da unidade.
 *
 * Tudo aqui é DERIVADO do que o razão, as contagens e as rodadas já dizem.
 * Nenhuma tabela nova, nenhuma RPC nova, nenhuma noção de "tarefa" no banco —
 * a fila é uma leitura. É por isso que ela existe sem encostar no backend
 * congelado da Etapa 1.
 *
 * O que deliberadamente NÃO está aqui, porque exigiria função nova: adiar ou
 * dispensar tarefa, cobrar alguém por notificação, e contagem regressiva até
 * um horário-alvo (o alvo das 09:00 é do Contexto Mestre, não é parâmetro).
 */

export type TomEtiqueta = 'alerta' | 'acento' | 'neutro'

export type Tarefa = {
  id: string
  prioridade: number
  etiqueta: string | null
  tom: TomEtiqueta
  titulo: string
  detalhe: string
  /** Sem ação = está com outra pessoa. Informa sem cobrar. */
  acao: { rotulo: string; href: string } | null
}

export type EstadoSetor = {
  setor: Setor
  contagem: 'AUSENTE' | 'EM_PREENCHIMENTO' | 'FINALIZADA'
  rodada: 'AUSENTE' | 'SUGERIDA' | 'SEPARADA' | 'RECEBIDA'
  separadoPor: string | null
  recebidoEm: string | null
  itensRodada: number
}

const nf = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 })

function dias(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

export async function montarPainel(ctx: Contexto, ciclo: string) {
  const supabase = await criarClienteServidor()

  const [setores, contagens, rodadas, divergencias, itens, locais, saldos] =
    await Promise.all([
      listarSetores(ctx.unidadeId),
      supabase
        .from('estoque_contagens')
        .select('id, setor_id, situacao')
        .eq('unidade_id', ctx.unidadeId)
        .eq('ciclo', ciclo),
      supabase
        .from('estoque_rodadas')
        .select('id, setor_id, situacao, separado_por, recebido_em')
        .eq('unidade_id', ctx.unidadeId)
        .eq('ciclo', ciclo),
      divergenciasPendentes(ctx.unidadeId),
      listarItens(ctx.unidadeId),
      listarLocais(ctx.unidadeId),
      carregarSaldos(ctx.unidadeId),
    ])

  const porSetorContagem = new Map(
    (contagens.data ?? []).map((c) => [c.setor_id, c]),
  )
  const porSetorRodada = new Map((rodadas.data ?? []).map((r) => [r.setor_id, r]))

  // Quantos itens cada rodada tem — numa consulta, não uma por rodada.
  const itensPorRodada = new Map<string, number>()
  const idsRodada = (rodadas.data ?? []).map((r) => r.id)
  if (idsRodada.length) {
    const { data } = await supabase
      .from('estoque_rodada_itens')
      .select('rodada_id')
      .in('rodada_id', idsRodada)
    for (const l of data ?? [])
      itensPorRodada.set(l.rodada_id, (itensPorRodada.get(l.rodada_id) ?? 0) + 1)
  }

  const estados: EstadoSetor[] = setores.map((s) => {
    const c = porSetorContagem.get(s.id)
    const r = porSetorRodada.get(s.id)
    return {
      setor: s,
      contagem: (c?.situacao as EstadoSetor['contagem']) ?? 'AUSENTE',
      rodada: (r?.situacao as EstadoSetor['rodada']) ?? 'AUSENTE',
      separadoPor: r?.separado_por ?? null,
      recebidoEm: r?.recebido_em ?? null,
      itensRodada: r ? (itensPorRodada.get(r.id) ?? 0) : 0,
    }
  })

  const nomeItem = new Map(itens.map((i) => [i.id, i.nome]))
  const nomeSetor = new Map(setores.map((s) => [s.id, s.nome]))
  const tarefas: Tarefa[] = []

  // Divergência é sempre o topo: prende saldo e envelhece.
  for (const d of divergencias) {
    const idade = dias(d.criada_em)
    tarefas.push({
      id: `div-${d.id}`,
      prioridade: idade >= 1 ? 0 : 1,
      etiqueta:
        idade >= 1 ? `PARADO HÁ ${idade} DIA${idade > 1 ? 'S' : ''}` : 'ABERTA HOJE',
      tom: idade >= 1 ? 'alerta' : 'acento',
      titulo:
        d.origem === 'TRANSITO'
          ? `Apurar ${nf.format(Number(d.quantidade))} em trânsito`
          : `Apurar ${nf.format(Number(d.quantidade))} a mais na contagem`,
      detalhe: `${nomeItem.get(d.item_id) ?? 'item'} · ${nomeSetor.get(d.setor_id) ?? ''}`,
      acao: pode(ctx, 'divergencia.apurar')
        ? { rotulo: 'Apurar agora', href: '/divergencias' }
        : null,
    })
  }

  for (const e of estados) {
    const href = `/abastecimento?setor=${e.setor.id}`

    if (e.rodada === 'SEPARADA') {
      const euSeparei = e.separadoPor === ctx.usuarioId
      const euRecebo = podeNoSetor(ctx, e.setor.id, 'abastecimento.receber')

      tarefas.push(
        euRecebo && !euSeparei
          ? {
              id: `rec-${e.setor.id}`,
              prioridade: 1,
              etiqueta: 'AGUARDANDO VOCÊ',
              tom: 'acento',
              titulo: `Receber no pulmão do ${e.setor.nome}`,
              detalhe: `${e.itensRodada} itens separados esperando conferência`,
              acao: { rotulo: 'Conferir e receber', href },
            }
          : {
              id: `rec-${e.setor.id}`,
              prioridade: 5,
              etiqueta: euSeparei ? 'COM O LÍDER' : 'COM OUTRA PESSOA',
              tom: 'neutro',
              titulo: `${e.setor.nome} aguarda recebimento`,
              detalhe: euSeparei
                ? 'Você separou. Quem confere é o líder do setor.'
                : `${e.itensRodada} itens em trânsito`,
              acao: null,
            },
      )
      continue
    }

    if (e.contagem === 'FINALIZADA' && e.rodada === 'AUSENTE') {
      if (pode(ctx, 'abastecimento.separar')) {
        tarefas.push({
          id: `sug-${e.setor.id}`,
          prioridade: 2,
          etiqueta: 'CONTAGEM FECHADA',
          tom: 'acento',
          titulo: `Preparar reposição do ${e.setor.nome}`,
          detalhe: 'Gerar a sugestão a partir da contagem',
          acao: { rotulo: 'Abrir', href },
        })
      }
      continue
    }

    if (e.rodada === 'SUGERIDA') {
      if (pode(ctx, 'abastecimento.separar')) {
        tarefas.push({
          id: `sep-${e.setor.id}`,
          prioridade: 2,
          etiqueta: 'ANTES DO TURNO',
          tom: 'acento',
          titulo: `Separar reposição do ${e.setor.nome}`,
          detalhe: `${e.itensRodada} itens sugeridos`,
          acao: { rotulo: 'Ver separação', href },
        })
      }
      continue
    }

    if (e.contagem !== 'FINALIZADA') {
      const euConto = podeNoSetor(ctx, e.setor.id, 'pulmao.contar')
      tarefas.push({
        id: `cont-${e.setor.id}`,
        prioridade: euConto ? 3 : 6,
        etiqueta: e.contagem === 'EM_PREENCHIMENTO' ? 'EM PREENCHIMENTO' : null,
        tom: 'neutro',
        titulo: euConto
          ? `Contar o pulmão do ${e.setor.nome}`
          : `${e.setor.nome} ainda não contou o pulmão`,
        detalhe: 'Sem a contagem não há sugestão de reposição',
        acao: euConto
          ? {
              rotulo: e.contagem === 'EM_PREENCHIMENTO' ? 'Continuar' : 'Contar',
              href: `/contagem?setor=${e.setor.id}`,
            }
          : null,
      })
    }
  }

  tarefas.sort((a, b) => a.prioridade - b.prioridade)

  const emTransito = locais
    .filter((l) => l.tipo === 'TRANSITO')
    .flatMap((l) => Object.values(saldos[l.id] ?? {}))
    .reduce((a, b) => a + b, 0)

  const principal = locais.find((l) => l.tipo === 'PRINCIPAL')

  return {
    tarefas,
    estados,
    divergencias: divergencias.length,
    emTransito,
    itensNoPrincipal: principal
      ? Object.values(saldos[principal.id] ?? {}).filter((q) => q > 0).length
      : 0,
    abastecidos: estados.filter((e) => e.rodada === 'RECEBIDA').length,
    totalSetores: estados.length,
  }
}
