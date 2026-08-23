import {
  carregarContexto,
  divergenciasPendentes,
  listarCausas,
  listarItens,
  listarSetores,
  pode,
} from '@/lib/estoque'
import { ListaDivergencias } from './lista'

export default async function Divergencias() {
  const ctx = await carregarContexto()
  if (!ctx) return null

  const [pendentes, causas, itens, setores] = await Promise.all([
    divergenciasPendentes(ctx.unidadeId),
    listarCausas(),
    listarItens(ctx.unidadeId),
    listarSetores(ctx.unidadeId),
  ])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Divergências pendentes</h1>
        <p className="mt-1 text-sm text-tinta-fraca">
          Nada aqui desaparece sozinho. A <strong>causa</strong> determina o
          destino do resíduo — não o operador: devolver ao Estoque Principal só
          é possível quando a causa comprova que a mercadoria nunca deixou a
          custódia.
        </p>
      </div>

      <ListaDivergencias
        pendentes={pendentes}
        causas={causas}
        itens={itens}
        setores={setores}
        podeApurar={pode(ctx, 'divergencia.apurar')}
      />
    </div>
  )
}
