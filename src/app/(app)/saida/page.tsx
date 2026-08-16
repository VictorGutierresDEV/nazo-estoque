import { redirect } from 'next/navigation'
import {
  carregarContexto,
  carregarSaldos,
  listarColaboradores,
  listarPracas,
  listarProdutos,
} from '@/lib/dados'
import { registrarSaida } from '@/lib/acoes'
import { FormMovimento } from '../form-movimento'

export default async function Saida() {
  const contexto = await carregarContexto()
  if (!contexto) return null
  if (!contexto.podeOperar) redirect('/')

  const [produtos, pracas, colaboradores, saldos] = await Promise.all([
    listarProdutos(contexto.unidadeId),
    listarPracas(contexto.unidadeId),
    listarColaboradores(contexto.unidadeId),
    carregarSaldos(contexto.unidadeId),
  ])

  const saldoCentral = Object.fromEntries(
    saldos.map((s) => [s.produtoId, s.central]),
  )

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Registrar saída</h1>
        <p className="mt-1 text-sm text-tinta-fraca">
          Item que sai do Estoque Central para o pulmão de uma praça. Registrado
          por você, em nome de quem levou.
        </p>
      </div>

      <FormMovimento
        modo="SAIDA"
        produtos={produtos.map((p) => ({ ...p, custo_medio: Number(p.custo_medio ?? 0) }))}
        saldoCentral={saldoCentral}
        pracas={pracas}
        colaboradores={colaboradores}
        acao={registrarSaida}
      />
    </div>
  )
}
