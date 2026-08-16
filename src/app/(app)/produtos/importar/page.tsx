import Link from 'next/link'
import { redirect } from 'next/navigation'
import { carregarContexto } from '@/lib/dados'
import { Importador } from './importador'

export default async function ImportarProdutos() {
  const contexto = await carregarContexto()
  if (!contexto) return null
  if (!contexto.podeOperar) redirect('/produtos')

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/produtos"
          className="text-sm text-tinta-fraca underline underline-offset-4 hover:text-acento"
        >
          ← Produtos
        </Link>
        <h1 className="mt-2 text-xl font-bold">Importar produtos</h1>
        <p className="mt-1 text-sm text-tinta-fraca">
          Envie a planilha no modelo que a operação usa. As colunas são
          reconhecidas pelo nome do cabeçalho — não há ordem obrigatória — e
          você confere o vínculo antes de qualquer coisa ser gravada.
        </p>
      </div>

      <Importador />
    </div>
  )
}
