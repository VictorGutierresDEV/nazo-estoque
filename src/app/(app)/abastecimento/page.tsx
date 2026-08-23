import {
  CICLO_HOJE,
  carregarContexto,
  carregarSaldos,
  contagemDoCiclo,
  listarItens,
  listarLocais,
  listarSetores,
  minimosDoPulmao,
  pode,
  podeNoSetor,
  rodadaDoCiclo,
} from '@/lib/estoque'
import { PainelAbastecimento } from './painel'

export default async function Abastecimento({
  searchParams,
}: PageProps<'/abastecimento'>) {
  const ctx = await carregarContexto()
  if (!ctx) return null

  const params = await searchParams
  const ciclo = typeof params.ciclo === 'string' ? params.ciclo : CICLO_HOJE()

  const setores = await listarSetores(ctx.unidadeId)
  const setorId =
    typeof params.setor === 'string' &&
    setores.some((s) => s.id === params.setor)
      ? params.setor
      : (setores[0]?.id ?? '')

  if (!setorId) return <div className="cartao p-6">Nenhum setor cadastrado.</div>

  const [itens, locais, saldos, contagem, rodada, minimos] = await Promise.all([
    listarItens(ctx.unidadeId),
    listarLocais(ctx.unidadeId),
    carregarSaldos(ctx.unidadeId),
    contagemDoCiclo(ctx.unidadeId, setorId, ciclo),
    rodadaDoCiclo(ctx.unidadeId, setorId, ciclo),
    minimosDoPulmao(ctx.unidadeId, setorId),
  ])

  const principal = locais.find((l) => l.tipo === 'PRINCIPAL')
  const transito = locais.find(
    (l) => l.tipo === 'TRANSITO' && l.setor_id === setorId,
  )

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Abastecimento do pulmão</h1>
        <p className="mt-1 text-sm text-tinta-fraca">
          A sugestão é <strong>mínimo do pulmão menos o contado</strong>. É
          sugestão, não ordem: o ajuste do Gerente de CPD fica registrado ao
          lado dela, e é esse par que depois mostra se o mínimo está mal
          calibrado.
        </p>
      </div>

      <PainelAbastecimento
        ciclo={ciclo}
        setores={setores}
        setorId={setorId}
        itens={itens}
        minimos={minimos}
        contagem={contagem.contagem}
        itensContados={contagem.itens}
        rodada={rodada.rodada}
        itensRodada={rodada.itens}
        saldoPrincipal={principal ? (saldos[principal.id] ?? {}) : {}}
        saldoTransito={transito ? (saldos[transito.id] ?? {}) : {}}
        podeSeparar={pode(ctx, 'abastecimento.separar')}
        podeReceber={podeNoSetor(ctx, setorId, 'abastecimento.receber')}
      />
    </div>
  )
}
