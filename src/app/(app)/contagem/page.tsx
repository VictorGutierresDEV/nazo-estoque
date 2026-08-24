import { redirect } from 'next/navigation'
import {
  CICLO_HOJE,
  carregarContexto,
  contagemDoCiclo,
  listarLideres,
  listarSetores,
  pode,
  podeNoSetor,
} from '@/lib/estoque'
import { filaDeContagem } from '@/lib/contagem'
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

  // O saldo do pulmão nunca chega ao navegador: a fila vem montada e sem
  // quantidade. A contagem é cega.
  const [{ fila, resto }, atual, lideres] = await Promise.all([
    filaDeContagem(ctx.unidadeId, setorId),
    contagemDoCiclo(ctx.unidadeId, setorId, ciclo),
    listarLideres(ctx.unidadeId, setorId),
  ])

  return (
    <FormContagem
      ciclo={ciclo}
      setores={setores}
      setorId={setorId}
      fila={fila}
      resto={resto}
      contagem={atual.contagem}
      itensContados={atual.itens}
      lideres={lideres}
      podeFinalizar={podeNoSetor(ctx, setorId, 'pulmao.finalizar_contagem')}
    />
  )
}
