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
import {
  acessoDeLeitura,
  escolherSetor,
  leituraRestrita,
} from '@/lib/acesso-leitura'
import { AvisoForaDoAcesso, SemSetorVisivel } from '../avisos-acesso'
import { PainelAbastecimento } from './painel'

export default async function Abastecimento({
  searchParams,
}: PageProps<'/abastecimento'>) {
  const ctx = await carregarContexto()
  if (!ctx) return null

  const params = await searchParams
  const ciclo = typeof params.ciclo === 'string' ? params.ciclo : CICLO_HOJE()

  const [setores, acesso] = await Promise.all([
    listarSetores(ctx.unidadeId),
    acessoDeLeitura(ctx.unidadeId),
  ])
  // Com a v57, fora da gestão, saldo do Principal e do trânsito não é lido:
  // a visão chegaria vazia e a tela mostraria 0. Vai `null` e a tela diz que
  // é reservado.
  const restrita = leituraRestrita(acesso)
  const { setorId, foraDoAcesso } = escolherSetor(setores, params.setor, acesso)

  if (!setorId) {
    if (acesso.modo === 'v57') return <SemSetorVisivel />
    return <div className="cartao p-6">Nenhum setor cadastrado.</div>
  }

  const [itens, locais, saldos, contagem, rodada, minimos] = await Promise.all([
    listarItens(ctx.unidadeId),
    restrita ? null : listarLocais(ctx.unidadeId),
    restrita ? null : carregarSaldos(ctx.unidadeId),
    contagemDoCiclo(ctx.unidadeId, setorId, ciclo),
    rodadaDoCiclo(ctx.unidadeId, setorId, ciclo),
    minimosDoPulmao(ctx.unidadeId, setorId),
  ])

  const principal = locais?.find((l) => l.tipo === 'PRINCIPAL')
  const transito = locais?.find(
    (l) => l.tipo === 'TRANSITO' && l.setor_id === setorId,
  )

  return (
    <div className="space-y-5">
      {foraDoAcesso && <AvisoForaDoAcesso />}
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
        saldoPrincipal={
          saldos ? (principal ? (saldos[principal.id] ?? {}) : {}) : null
        }
        saldoTransito={
          saldos ? (transito ? (saldos[transito.id] ?? {}) : {}) : null
        }
        podeSeparar={pode(ctx, 'abastecimento.separar')}
        podeReceber={podeNoSetor(ctx, setorId, 'abastecimento.receber')}
      />
    </div>
  )
}
