import { redirect } from 'next/navigation'
import {
  carregarContexto,
  carregarSaldos,
  listarItens,
  listarLocais,
  listarSetores,
  locaisConcluidos,
  nomesDePessoas,
  pode,
} from '@/lib/estoque'
import { FormImplantacao } from './form'

export default async function Implantacao() {
  const ctx = await carregarContexto()
  if (!ctx) return null
  if (!pode(ctx, 'saldo_inicial.lancar')) redirect('/')
  if (ctx.emProducao) redirect('/')

  const [itens, setores, locais, saldos, concluidos] = await Promise.all([
    listarItens(ctx.unidadeId),
    listarSetores(ctx.unidadeId),
    listarLocais(ctx.unidadeId),
    carregarSaldos(ctx.unidadeId),
    locaisConcluidos(ctx.unidadeId),
  ])

  const pessoas = await nomesDePessoas(concluidos.map((c) => c.concluido_por))
  const porLocal = new Map(concluidos.map((c) => [c.local_id, c]))

  const principal = locais.find((l) => l.tipo === 'PRINCIPAL')
  const pulmoes = locais.filter((l) => l.tipo === 'PULMAO')

  // A checklist é o que libera a virada. Existência de movimento NÃO conta:
  // um pulmão pode legitimamente ter todos os itens em zero.
  const checklist = [
    {
      localId: principal?.id ?? '',
      setorId: null as string | null,
      nome: 'Estoque Principal',
      itensLancados: principal
        ? Object.keys(saldos[principal.id] ?? {}).length
        : 0,
      concluido: principal ? porLocal.get(principal.id) : undefined,
    },
    ...setores.map((s) => {
      const local = pulmoes.find((p) => p.setor_id === s.id)
      return {
        localId: local?.id ?? '',
        setorId: s.id,
        nome: s.nome,
        itensLancados: local ? Object.keys(saldos[local.id] ?? {}).length : 0,
        concluido: local ? porLocal.get(local.id) : undefined,
      }
    }),
  ]

  const jaLancados: Record<string, Record<string, number>> = {
    __principal__: principal ? (saldos[principal.id] ?? {}) : {},
  }
  for (const s of setores) {
    const local = pulmoes.find((p) => p.setor_id === s.id)
    jaLancados[s.id] = local ? (saldos[local.id] ?? {}) : {}
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Inventário de implantação</h1>
        <p className="mt-1 text-sm text-tinta-fraca">
          A contagem física da virada. É a <strong>única</strong> origem de saldo
          que não vem de movimentação — depois que a unidade entrar em produção,
          esta tela desaparece e todo saldo passa a ser consequência dos fluxos.
        </p>
      </div>

      <FormImplantacao
        itens={itens}
        setores={setores}
        jaLancados={jaLancados}
        checklist={checklist.map((c) => ({
          localId: c.localId,
          setorId: c.setorId,
          nome: c.nome,
          itensLancados: c.itensLancados,
          concluidoEm: c.concluido?.concluido_em ?? null,
          concluidoPor: c.concluido
            ? (pessoas[c.concluido.concluido_por] ?? '—')
            : null,
        }))}
      />
    </div>
  )
}
