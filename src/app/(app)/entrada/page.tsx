import { redirect } from 'next/navigation'
import { carregarContexto, carregarSaldos, listarProdutos } from '@/lib/dados'
import { registrarEntrada } from '@/lib/acoes'
import { FormMovimento } from '../form-movimento'

export default async function Entrada() {
  const contexto = await carregarContexto()
  if (!contexto) return null
  if (!contexto.podeOperar) redirect('/')

  const [produtos, saldos] = await Promise.all([
    listarProdutos(contexto.unidadeId),
    carregarSaldos(contexto.unidadeId),
  ])

  const saldoCentral = Object.fromEntries(
    saldos.map((s) => [s.produtoId, s.central]),
  )

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Registrar entrada</h1>
        <p className="mt-1 text-sm text-tinta-fraca">
          O que chega ao Estoque Central. O custo unitário informado recalcula o
          custo médio do produto — é ele que valoriza as saídas em R$.
        </p>
      </div>

      <FormMovimento
        modo="ENTRADA"
        produtos={produtos.map((p) => ({ ...p, custo_medio: Number(p.custo_medio ?? 0) }))}
        saldoCentral={saldoCentral}
        acao={registrarEntrada}
      />
    </div>
  )
}
