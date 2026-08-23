import Link from 'next/link'
import { redirect } from 'next/navigation'
import { carregarContexto, pode } from '@/lib/estoque'
import { Importador } from './importador'

export default async function ImportarItens() {
  const ctx = await carregarContexto()
  if (!ctx) return null
  if (!pode(ctx, 'cadastro.gerenciar')) redirect('/itens')

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/itens"
          className="text-sm text-tinta-fraca underline underline-offset-4 hover:text-acento"
        >
          ← Itens
        </Link>
        <h1 className="mt-2 text-xl font-bold">Importar itens</h1>
        <p className="mt-1 text-sm text-tinta-fraca">
          O modelo da planilha é seu: as colunas são reconhecidas pelo nome do
          cabeçalho e você confere o vínculo antes de gravar. Colunas de
          quantidade e custo, se existirem, são ignoradas — saldo entra pelo
          inventário de implantação.
        </p>
      </div>

      <Importador />
    </div>
  )
}
