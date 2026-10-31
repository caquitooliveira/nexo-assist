export type CandidatoRevisao = {
  id: string
  numero: string
  titulo: string
  descricao: string
  status: string
  atualizadoEm: string
}

export type OpcoesConfirmacao = {
  chamadoId?: string
  versaoChamado?: string
  revisados?: {
    id: string
    atualizadoEm: string
  }[]
}

type RevisaoChamadosProps = {
  candidatos: CandidatoRevisao[]
  ocupado: boolean
  onConfirmar: (opcoes: OpcoesConfirmacao) => void
}

function RevisaoChamados({
  candidatos,
  ocupado,
  onConfirmar,
}: RevisaoChamadosProps) {
  return (
    <section className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <h3 className="text-sm font-semibold text-amber-900">
        Confira os chamados encontrados
      </h3>

      <p className="mt-2 text-xs leading-5 text-amber-800">
        Eles pertencem ao mesmo tipo e categoria do rascunho.
        Confira se algum trata do mesmo problema.
      </p>

      <div className="mt-4 space-y-3">
        {candidatos.map((candidato) => {
          const resolvido = candidato.status === 'RESOLVIDO'

          return (
            <div
              key={candidato.id}
              className="rounded-lg border border-amber-200 bg-white p-3"
            >
              <p className="text-sm font-semibold text-slate-800">
                {candidato.numero} · {candidato.titulo}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                {resolvido ? 'Resolvido recentemente' : 'Chamado aberto'}
              </p>

              <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-slate-600">
                {candidato.descricao}
              </p>

              <button
                type="button"
                disabled={ocupado}
                onClick={() =>
                  onConfirmar({
                    chamadoId: candidato.id,
                    versaoChamado: candidato.atualizadoEm,
                  })
                }
                className="mt-3 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {resolvido
                  ? 'Confirmar reabertura e complemento'
                  : 'Confirmar complemento neste chamado'}
              </button>
            </div>
          )
        })}
      </div>

      <div className="mt-4 border-t border-amber-200 pt-3">
        <p className="mb-2 text-xs leading-5 text-amber-800">
          Se nenhum deles tratar do problema descrito no rascunho,
          você pode confirmar a criação de outro chamado.
        </p>

        <button
          type="button"
          disabled={ocupado}
          onClick={() =>
            onConfirmar({
              revisados: candidatos.map((candidato) => ({
                id: candidato.id,
                atualizadoEm: candidato.atualizadoEm,
              })),
            })
          }
          className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
        >
          Revisei: é outro problema. Confirmar novo chamado
        </button>
      </div>
    </section>
  )
}

export default RevisaoChamados