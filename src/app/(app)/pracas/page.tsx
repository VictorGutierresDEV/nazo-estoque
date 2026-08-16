import { carregarContexto, listarPracas } from '@/lib/dados'
import { FormPraca } from './form'

export default async function Pracas() {
  const contexto = await carregarContexto()
  if (!contexto) return null

  const pracas = await listarPracas(contexto.unidadeId)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Praças</h1>
        <p className="mt-1 text-sm text-tinta-fraca">
          Cada praça tem seu estoque pulmão. No vStoque isto era uma lista fixa
          no código e criar praça nova exigia mexer no banco — aqui é cadastro.
        </p>
      </div>

      {contexto.podeOperar && <FormPraca />}

      <section className="cartao overflow-hidden">
        <h2 className="border-b border-borda px-4 py-3 text-sm font-semibold">
          Cadastradas ({pracas.length})
        </h2>
        {pracas.length === 0 ? (
          <p className="px-4 py-6 text-sm text-tinta-fraca">
            Nenhuma praça ainda.
          </p>
        ) : (
          <ul className="divide-y divide-borda">
            {pracas.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <span className="font-medium">{p.nome}</span>
                <span className="text-xs text-tinta-fraca">{p.codigo}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
