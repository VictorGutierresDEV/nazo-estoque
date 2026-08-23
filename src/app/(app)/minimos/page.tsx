import {
  carregarContexto,
  listarItens,
  listarSetores,
  minimosDaCasa,
  minimosDoPulmao,
  pode,
} from '@/lib/estoque'
import { EditorMinimos } from './editor'

export default async function Minimos({ searchParams }: PageProps<'/minimos'>) {
  const ctx = await carregarContexto()
  if (!ctx) return null

  const params = await searchParams
  const escopo = params.escopo === 'casa' ? 'casa' : 'pulmao'

  const setores = await listarSetores(ctx.unidadeId)
  const setorId =
    typeof params.setor === 'string' &&
    setores.some((s) => s.id === params.setor)
      ? params.setor
      : (setores[0]?.id ?? '')

  const [itens, doPulmao, daCasa] = await Promise.all([
    listarItens(ctx.unidadeId),
    setorId ? minimosDoPulmao(ctx.unidadeId, setorId) : Promise.resolve({}),
    minimosDaCasa(ctx.unidadeId),
  ])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Mínimos</h1>
        <p className="mt-1 text-sm text-tinta-fraca">
          São <strong>dois parâmetros distintos</strong>. O do pulmão é por
          setor e dirige a separação diária. O da casa é por item e serve à
          decisão de pedido, comparado com praça + pulmão + principal.
        </p>
      </div>

      <EditorMinimos
        escopo={escopo}
        setores={setores}
        setorId={setorId}
        itens={itens}
        valores={escopo === 'pulmao' ? doPulmao : daCasa}
        podeDefinirPulmao={pode(ctx, 'parametro.minimo_pulmao.definir')}
        podeDefinirCasa={pode(ctx, 'parametro.minimo_casa.definir')}
        podeSugerir={pode(ctx, 'parametro.sugerir')}
      />
    </div>
  )
}
