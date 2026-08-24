import { redirect } from 'next/navigation'
import {
  CICLO_HOJE,
  carregarContexto,
  contagemDoCiclo,
  listarItens,
  listarLideres,
  listarSetores,
  pode,
  podeNoSetor,
} from '@/lib/estoque'
import { FormContagem } from './form'

export default async function Contagem({
  searchParams,
}: PageProps<'/contagem'>) {
  const ctx = await carregarContexto()
  if (!ctx) return null
  if (!pode(ctx, 'pulmao.contar')) redirect('/')

  const params = await searchParams
  const ciclo = typeof params.ciclo === 'string' ? params.ciclo : CICLO_HOJE()

  const setores = (await listarSetores(ctx.unidadeId)).filter((s) =>
    podeNoSetor(ctx, s.id, 'pulmao.contar'),
  )

  if (!setores.length) {
    return (
      <div className="cartao p-6">
        <h1 className="text-lg font-bold">Nenhum setor vinculado</h1>
        <p className="mt-2 text-sm text-tinta-fraca">
          Você tem permissão para contar, mas não está vinculado a nenhum setor.
          Quem atribui o vínculo é a direção ou o Gerente de CPD, junto com a
          função operacional.
        </p>
      </div>
    )
  }

  const setorId =
    typeof params.setor === 'string' &&
    setores.some((s) => s.id === params.setor)
      ? params.setor
      : setores[0].id

  // O saldo do pulmão NÃO é carregado aqui de propósito: a contagem é cega.
  // Enviar o esperado para o navegador seria vazá-lo, mesmo sem exibir na tela.
  const [itens, atual, lideres] = await Promise.all([
    listarItens(ctx.unidadeId),
    contagemDoCiclo(ctx.unidadeId, setorId, ciclo),
    listarLideres(ctx.unidadeId, setorId),
  ])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Contagem do pulmão</h1>
        <p className="mt-1 text-sm text-tinta-fraca">
          Contagem <strong>diária</strong> do saldo que restou no pulmão. Não é a
          contagem geral da casa de terça, quinta e domingo — são processos
          distintos, e a geral segue no Checklist Fácil por enquanto.
        </p>
      </div>

      <FormContagem
        ciclo={ciclo}
        setores={setores}
        setorId={setorId}
        itens={itens}
        contagem={atual.contagem}
        itensContados={atual.itens}
        lideres={lideres}
        podeFinalizar={podeNoSetor(ctx, setorId, 'pulmao.finalizar_contagem')}
      />
    </div>
  )
}
