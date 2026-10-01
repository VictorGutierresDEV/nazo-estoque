import {
  carregarContexto,
  listarItens,
  listarSetores,
  minimosDaCasa,
  minimosDoPulmao,
  pode,
} from '@/lib/estoque'
import { acessoDeLeitura, escolherSetor } from '@/lib/acesso-leitura'
import { AvisoForaDoAcesso } from '../avisos-acesso'
import { EditorMinimos } from './editor'

export default async function Minimos({ searchParams }: PageProps<'/minimos'>) {
  const ctx = await carregarContexto()
  if (!ctx) return null

  const params = await searchParams

  const [setores, acesso] = await Promise.all([
    listarSetores(ctx.unidadeId),
    acessoDeLeitura(ctx.unidadeId),
  ])
  const { setorId, foraDoAcesso } = escolherSetor(setores, params.setor, acesso)

  // Com a v57, sem setor visível não há pulmão a editar: a aba some e fica o
  // mínimo da casa (nada de gravar mínimo de pulmão sem setor).
  const semSetorVisivel = acesso.modo === 'v57' && setores.length === 0
  const escopo =
    params.escopo === 'casa' || semSetorVisivel ? 'casa' : 'pulmao'

  const [itens, doPulmao, daCasa] = await Promise.all([
    listarItens(ctx.unidadeId),
    setorId ? minimosDoPulmao(ctx.unidadeId, setorId) : Promise.resolve({}),
    minimosDaCasa(ctx.unidadeId),
  ])

  return (
    <div className="space-y-5">
      {foraDoAcesso && escopo === 'pulmao' && <AvisoForaDoAcesso />}
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
        semSetorVisivel={semSetorVisivel}
        itens={itens}
        valores={escopo === 'pulmao' ? doPulmao : daCasa}
        podeDefinirPulmao={pode(ctx, 'parametro.minimo_pulmao.definir')}
        podeDefinirCasa={pode(ctx, 'parametro.minimo_casa.definir')}
        podeSugerir={pode(ctx, 'parametro.sugerir')}
      />
    </div>
  )
}
