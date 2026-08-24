import Link from 'next/link'
import {
  CICLO_HOJE,
  carregarContexto,
  estadoDaImplantacao,
  pode,
} from '@/lib/estoque'
import { montarPainel, type EstadoSetor, type Tarefa } from '@/lib/painel'
import { quantidade as fmt } from '@/lib/formato'

const TOM = {
  alerta: 'text-alerta bg-alerta/10',
  acento: 'text-acento bg-acento-fraco',
  neutro: 'text-tinta-fraca bg-borda/60',
} as const

export default async function Painel() {
  const ctx = await carregarContexto()
  if (!ctx) return null

  const implantacao = await estadoDaImplantacao(ctx.unidadeId)

  if (implantacao.itensLancados === 0) {
    return (
      <div className="cartao p-6">
        <h1 className="text-lg font-bold">Estoque ainda não implantado</h1>
        <p className="mt-2 text-sm text-tinta-fraca">
          Nenhum saldo inicial lançado. O sistema começa pela contagem física da
          virada — Estoque Principal e pulmões dos setores.
        </p>
        {pode(ctx, 'saldo_inicial.lancar') ? (
          <Link href="/implantacao" className="botao mt-4">
            Ir para o inventário de implantação
          </Link>
        ) : (
          <p className="mt-4 text-sm text-alerta">
            Quem lança o inventário de implantação é a direção, o Gerente de CPD
            ou o estoquista.
          </p>
        )}
      </div>
    )
  }

  const ciclo = CICLO_HOJE()
  const p = await montarPainel(ctx, ciclo)

  const acionaveis = p.tarefas.filter((t) => t.acao)
  const emOrdem = p.estados.filter(
    (e) => e.rodada === 'RECEBIDA' || (e.contagem === 'FINALIZADA' && e.rodada === 'AUSENTE'),
  )

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:gap-6">
      {/* ------------------------------ fila ------------------------------ */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h1 className="text-xl font-bold tracking-tight">
            O que fazer agora
          </h1>
          <span className="text-sm text-tinta-fraca">
            {acionaveis.length === 0
              ? 'nada pendente'
              : `${acionaveis.length} pendência${acionaveis.length > 1 ? 's' : ''}`}
          </span>
        </div>

        {p.tarefas.length === 0 ? (
          <div className="cartao p-6">
            <p className="text-base font-semibold text-positivo">
              Ciclo de hoje em ordem
            </p>
            <p className="mt-1.5 text-sm text-tinta-fraca">
              Todos os setores contados e abastecidos, nenhuma divergência
              aberta.
            </p>
          </div>
        ) : (
          p.tarefas.map((t) => <CartaoTarefa key={t.id} tarefa={t} />)
        )}

        {/* atalhos de consulta, fora do caminho */}
        <div className="flex flex-wrap gap-2 pt-1">
          {[
            ['/itens', 'Itens'],
            ['/minimos', 'Mínimos'],
            ['/extrato', 'Extrato'],
          ].map(([href, rotulo]) => (
            <Link
              key={href}
              href={href}
              className="rounded-lg border border-borda bg-cartao px-3 py-2 text-sm text-tinta-fraca transition hover:border-acento hover:text-tinta"
            >
              {rotulo}
            </Link>
          ))}
        </div>
      </section>

      {/* --------------------------- ciclo do dia --------------------------- */}
      <section className="mt-8 space-y-3 lg:mt-0">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Numero rotulo="Pulmões abastecidos" valor={`${p.abastecidos}`} de={`${p.totalSetores}`} />
          <Numero
            rotulo="Em trânsito agora"
            valor={fmt(p.emTransito)}
            alerta={p.emTransito > 0}
          />
          <Numero
            rotulo="Divergências"
            valor={`${p.divergencias}`}
            alerta={p.divergencias > 0}
          />
          <Numero rotulo="Itens no Principal" valor={`${p.itensNoPrincipal}`} />
        </div>

        <div className="cartao overflow-hidden">
          <div className="flex items-baseline justify-between border-b border-borda px-4 py-3">
            <h2 className="text-sm font-semibold">Ciclo do dia</h2>
            <span className="text-xs text-tinta-fraca">{ciclo}</span>
          </div>
          <ul className="divide-y divide-borda">
            {p.estados.map((e) => (
              <LinhaSetor key={e.setor.id} estado={e} />
            ))}
          </ul>
        </div>

        {emOrdem.length > 0 && (
          <p className="px-1 text-xs text-tinta-fraca lg:hidden">
            Em ordem: {emOrdem.map((e) => e.setor.nome).join(', ')}
          </p>
        )}
      </section>
    </div>
  )
}

function CartaoTarefa({ tarefa }: { tarefa: Tarefa }) {
  const informativa = !tarefa.acao
  return (
    <div
      className={`cartao p-4 ${informativa ? 'opacity-70' : ''} ${
        tarefa.prioridade === 0 ? 'border-l-[3px] border-l-alerta' : ''
      }`}
    >
      {tarefa.etiqueta && (
        <span
          className={`inline-block rounded px-2 py-1 text-[11px] font-bold tracking-wide ${TOM[tarefa.tom]}`}
        >
          {tarefa.etiqueta}
        </span>
      )}
      <h3
        className={`mt-2 font-semibold leading-snug ${
          informativa ? 'text-base' : 'text-[17px]'
        }`}
      >
        {tarefa.titulo}
      </h3>
      <p className="mt-1 text-sm leading-relaxed text-tinta-fraca">
        {tarefa.detalhe}
      </p>
      {tarefa.acao && (
        <Link
          href={tarefa.acao.href}
          className="botao mt-3 w-full sm:w-auto sm:min-w-48"
        >
          {tarefa.acao.rotulo}
        </Link>
      )}
    </div>
  )
}

function Numero({
  rotulo,
  valor,
  de,
  alerta,
}: {
  rotulo: string
  valor: string
  de?: string
  alerta?: boolean
}) {
  return (
    <div className="cartao px-4 py-3">
      <p className="text-xs text-tinta-fraca">{rotulo}</p>
      <p
        className={`mt-1 text-2xl font-bold tabular-nums leading-none ${
          alerta ? 'text-alerta' : ''
        }`}
      >
        {valor}
        {de && (
          <span className="text-base font-medium text-tinta-fraca"> / {de}</span>
        )}
      </p>
    </div>
  )
}

/** Trilha Contar → Separar → Receber, do jeito que a operação enxerga. */
function LinhaSetor({ estado }: { estado: EstadoSetor }) {
  const contou = estado.contagem === 'FINALIZADA'
  const separou = estado.rodada === 'SEPARADA' || estado.rodada === 'RECEBIDA'
  const recebeu = estado.rodada === 'RECEBIDA'

  const situacao = recebeu
    ? { texto: 'completo', cor: 'text-positivo' }
    : separou
      ? { texto: 'em trânsito', cor: 'text-acento' }
      : estado.rodada === 'SUGERIDA'
        ? { texto: 'separar', cor: 'text-acento' }
        : contou
          ? { texto: 'gerar sugestão', cor: 'text-acento' }
          : { texto: 'falta contar', cor: 'text-alerta' }

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span className="w-20 shrink-0 text-sm font-semibold">
        {estado.setor.nome}
      </span>
      <span className="flex shrink-0 items-center">
        <Passo feito={contou} n={1} />
        <Liga feito={contou} />
        <Passo feito={separou} n={2} />
        <Liga feito={separou} />
        <Passo feito={recebeu} n={3} />
      </span>
      <span className={`flex-1 truncate text-xs font-medium ${situacao.cor}`}>
        {situacao.texto}
      </span>
    </li>
  )
}

function Passo({ feito, n }: { feito: boolean; n: number }) {
  return (
    <span
      className={`flex size-[22px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
        feito
          ? 'bg-positivo text-white'
          : 'border border-borda bg-papel text-tinta-fraca'
      }`}
    >
      {feito ? '✓' : n}
    </span>
  )
}

function Liga({ feito }: { feito: boolean }) {
  return (
    <span
      className={`h-0.5 w-4 shrink-0 ${feito ? 'bg-positivo' : 'bg-borda'}`}
    />
  )
}
