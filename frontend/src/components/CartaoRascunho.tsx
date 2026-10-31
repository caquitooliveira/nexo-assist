import { useEffect, useState } from 'react'
import EditorRascunho from './EditorRascunho'

type Rascunho = {
  id: string
  titulo: string
  descricao: string
  tipo: string
  categoria: string
  prioridade: string
  afetados: string
  atualizadoEm: string
}

type ChamadoCriado = {
  numero: string
  titulo: string
}

type MensagemSalva = {
  id: string
  autor: string
  texto: string
}

type Candidato = {
  id: string
  numero: string
  titulo: string
  status: string
}

type ResultadoConfirmacao = {
  status?: string
  mensagem?: string
  chamado?: ChamadoCriado
  candidatos?: Candidato[]
}

type CartaoRascunhoProps = {
  conversaId: string
  token: string | null
  atualizacao: number
  onMensagemSalva: (mensagem: MensagemSalva) => void
}

const API_URL = 'http://localhost:3000'

const ROTULOS_PRIORIDADE: Record<string, string> = {
  Critica: 'Crítica',
  Alta: 'Alta',
  Media: 'Média',
  Baixa: 'Baixa',
}


function CartaoRascunho({
  conversaId,
  token,
  atualizacao,
  onMensagemSalva,
}: CartaoRascunhoProps) {
  const [rascunho, setRascunho] = useState<Rascunho | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [confirmando, setConfirmando] = useState(false)
  const [cancelando, setCancelando] = useState(false)
  const [editando, setEditando] = useState(false)
  const [erro, setErro] = useState('')
  const [chamadoCriado, setChamadoCriado] =
    useState<ChamadoCriado | null>(null)
  const [candidatos, setCandidatos] = useState<Candidato[]>([])

  useEffect(() => {
    const controller = new AbortController()

    async function carregarRascunho() {
      setCarregando(true)
      setErro('')
      setCandidatos([])

      if (!token) {
        setRascunho(null)
        setCarregando(false)
        setErro('Faça login novamente para consultar o rascunho.')
        return
      }

      try {
        const resposta = await fetch(
          `${API_URL}/conversas/${conversaId}/rascunho`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            signal: controller.signal,
          },
        )

        if (!resposta.ok) {
          throw new Error('Não foi possível carregar o rascunho.')
        }

        const dados: { rascunho: Rascunho | null } =
          await resposta.json()

        setRascunho(dados.rascunho)

        if (dados.rascunho) {
          setChamadoCriado(null)
        }
      } catch (erroCapturado) {
        if (controller.signal.aborted) return

        console.error('Erro ao carregar rascunho:', erroCapturado)
        setErro(
          'Não foi possível atualizar o rascunho. Recarregue a página.',
        )
      } finally {
        if (!controller.signal.aborted) {
          setCarregando(false)
        }
      }
    }

    void carregarRascunho()

    return () => controller.abort()
  }, [conversaId, token, atualizacao])

  async function confirmar() {
    if (!token || !rascunho || confirmando || cancelando) return

    setConfirmando(true)
    setErro('')
    setCandidatos([])

    try {
      const resposta = await fetch(
        `${API_URL}/conversas/${conversaId}/rascunho/${rascunho.id}/confirmar`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      )

      const dados: ResultadoConfirmacao = await resposta.json()

      if (!resposta.ok) {
        if (dados.status === 'REVISAO_NECESSARIA') {
          setCandidatos(dados.candidatos ?? [])
        }

        throw new Error(
          dados.mensagem || 'Não foi possível confirmar o chamado.',
        )
      }

      if (!dados.chamado) {
        throw new Error('O servidor não retornou os dados do chamado.')
      }

      setChamadoCriado(dados.chamado)
      setRascunho(null)
    } catch (erroCapturado) {
      setErro(
        erroCapturado instanceof Error
          ? erroCapturado.message
          : 'Não foi possível confirmar o chamado.',
      )
    } finally {
      setConfirmando(false)
    }
  }

  async function cancelar() {
    if (!token || !rascunho || cancelando || confirmando) return

    setCancelando(true)
    setErro('')

    try {
      const resposta = await fetch(
        `${API_URL}/conversas/${conversaId}/rascunho/${rascunho.id}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      )

      if (!resposta.ok) {
        const dados: { mensagem?: string } = await resposta.json()

        throw new Error(
          dados.mensagem || 'Não foi possível cancelar o rascunho.',
        )
      }

      const dados: {
        mensagem: MensagemSalva
      } = await resposta.json()

      setRascunho(null)
      setCandidatos([])
      onMensagemSalva(dados.mensagem)
    } catch (erroCapturado) {
      setErro(
        erroCapturado instanceof Error
          ? erroCapturado.message
          : 'Não foi possível cancelar o rascunho.',
      )
    } finally {
      setCancelando(false)
    }
  }

  if (carregando) {
    return (
      <p role="status" className="mb-4 text-xs text-slate-500">
        Consultando rascunho...
      </p>
    )
  }

  if (chamadoCriado) {
    return (
      <section
        role="status"
        className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-5"
      >
        <p className="text-sm font-semibold text-emerald-800">
          Chamado confirmado
        </p>

        <p className="mt-2 text-sm text-emerald-900">
          {chamadoCriado.numero} · {chamadoCriado.titulo}
        </p>

        <p className="mt-2 text-xs text-emerald-700">
          Sua solicitação foi registrada e aguarda atendimento.
        </p>
      </section>
    )
  }

  if (!rascunho) {
    return erro ? (
      <p role="alert" className="mb-4 text-sm text-red-600">
        {erro}
      </p>
    ) : null
  }

  if (editando) {
  return (
    <section className="mb-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-base font-semibold text-slate-800">
        Editar rascunho
      </h2>

      <EditorRascunho
        key={`${rascunho.id}-${rascunho.atualizadoEm}`}
        conversaId={conversaId}
        token={token}
        rascunho={rascunho}
        onCancelar={() => setEditando(false)}
        onSalvar={(dados, mensagem) => {
          setRascunho((anterior) => {
            if (!anterior) return anterior

            return {
              ...anterior,
              titulo: dados.titulo,
              descricao: dados.descricao,
            }
          })

          setErro('')
          setCandidatos([])
          setEditando(false)
          onMensagemSalva(mensagem)
        }}
      />
    </section>
  )
}

  const prioridade =
    ROTULOS_PRIORIDADE[rascunho.prioridade] ?? rascunho.prioridade

  return (
    <section
      aria-labelledby="titulo-rascunho"
      className="mb-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          Novo chamado · Rascunho
        </p>

        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
          Aguardando confirmação
        </span>
      </div>

      <h2
        id="titulo-rascunho"
        className="mt-3 text-base font-semibold text-slate-800"
      >
        {rascunho.titulo}
      </h2>

      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">
        {rascunho.descricao}
      </p>

      <dl className="mt-4 grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-slate-500">Tipo</dt>
          <dd className="mt-1 font-medium text-slate-700">
            {rascunho.tipo === 'INC' ? 'Incidente' : 'Requisição'}
          </dd>
        </div>

        <div>
          <dt className="text-xs text-slate-500">Categoria</dt>
          <dd className="mt-1 font-medium text-slate-700">
            {rascunho.categoria}
          </dd>
        </div>

        <div>
          <dt className="text-xs text-slate-500">Prioridade</dt>
          <dd className="mt-1 font-medium text-slate-700">
            {prioridade}
          </dd>
        </div>

        <div>
          <dt className="text-xs text-slate-500">Pessoas afetadas</dt>
          <dd className="mt-1 font-medium text-slate-700">
            {rascunho.afetados}
          </dd>
        </div>
      </dl>

      {erro && (
        <p role="alert" className="mt-4 text-sm text-red-600">
          {erro}
        </p>
      )}

      {candidatos.length > 0 && (
        <div className="mt-3 rounded-lg bg-amber-50 p-3">
          <p className="text-xs font-medium text-amber-800">
            Revise estes chamados antes de abrir outro:
          </p>

          <ul className="mt-2 space-y-2 text-xs text-amber-900">
            {candidatos.map((candidato) => (
              <li key={candidato.id}>
                {candidato.numero} · {candidato.titulo}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 border-t border-slate-100 pt-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={confirmar}
            disabled={
              confirmando ||
              cancelando ||
              candidatos.length > 0
            }
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {confirmando ? 'Confirmando...' : 'Confirmar chamado'}
          </button>

          <button
            type="button"
            onClick={cancelar}
            disabled={confirmando || cancelando}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelando ? 'Cancelando...' : 'Cancelar rascunho'}
          </button>

          <button
  type="button"
  onClick={() => {
    setErro('')
    setEditando(true)
  }}
  disabled={confirmando || cancelando}
  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
>
  Editar
</button>
        </div>

        <p className="mt-3 text-xs text-slate-500">
          Confirme para abrir o chamado ou cancele para descartar o rascunho.
        </p>
      </div>
    </section>
  )
}

export default CartaoRascunho