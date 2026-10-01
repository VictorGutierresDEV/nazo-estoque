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
import {
  acessoDeLeitura,
  escolherSetor,
  leituraRestrita,
} from '@/lib/acesso-leitura'
import { AvisoForaDoAcesso, SemSetorVisivel } from '../avisos-acesso'
import { FormContagem } from './form'

export default async function Contagem({
  searchParams,
}: PageProps<'/contagem'>) {
  const ctx = await carregarContexto()
  if (!ctx) return null
  if (!pode(ctx, 'pulmao.contar')) redirect('/')

  const params = await searchParams
  const ciclo = typeof params.ciclo === 'string' ? params.ciclo : CICLO_HOJE()

  const [visiveis, acesso] = await Promise.all([
    listarSetores(ctx.unidadeId),
    acessoDeLeitura(ctx.unidadeId),
  ])
  const setores = visiveis.filter((s) => podeNoSetor(ctx, s.id, 'pulmao.contar'))

  // Com a v57, a lista vazia pode ser a RLS, não a falta de vínculo.
  if (acesso.modo === 'v57' && !visiveis.length) return <SemSetorVisivel />

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

  const { setorId, foraDoAcesso } = escolherSetor(setores, params.setor, acesso)

  // O saldo do pulmão nunca chega ao navegador: a fila vem montada e sem
  // quantidade. A contagem é cega.
  const [{ fila, resto }, atual, { lideres, algumDeForaDoSetor }] =
    await Promise.all([
      filaDeContagem(ctx.unidadeId, setorId),
      contagemDoCiclo(ctx.unidadeId, setorId, ciclo),
      listarLideres(ctx.unidadeId, setorId),
    ])

  // v57, fora da gestão: a RLS só mostra as pessoas do setor. A lista não é
  // ampliada aqui (é decisão de papel); só se explica a lista curta.
  const notaLideres =
    leituraRestrita(acesso) && !algumDeForaDoSetor
      ? 'Mostrando as pessoas do seu setor.'
      : null

  return (
    <>
      {foraDoAcesso && <AvisoForaDoAcesso />}
      <FormContagem
        ciclo={ciclo}
        setores={setores}
        setorId={setorId}
        fila={fila}
        resto={resto}
        contagem={atual.contagem}
        itensContados={atual.itens}
        lideres={lideres}
        notaLideres={notaLideres}
        podeFinalizar={podeNoSetor(ctx, setorId, 'pulmao.finalizar_contagem')}
      />
    </>
  )
}
