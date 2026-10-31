import { useState } from 'react'

type MensagemTransferencia = {
  id: string
  autor: string
  texto: string
}

type AtendimentoHumanoProps = {
  conversaId: string
  status: string
  token: string | null
  enviandoMensagem: boolean
  onTransferir: (
    status: string,
    mensagem?: MensagemTransferencia,
  ) => void
}

function AtendimentoHumano({
  conversaId,
  status,
  token,
  enviandoMensagem,
  onTransferir,
}: AtendimentoHumanoProps) {
  const [transferindo, setTransferindo] = useState(false)
  const [erro, setErro] = useState('')

  async function transferir() {
    if (!token || transferindo || enviandoMensagem) return

    setTransferindo(true)
    setErro('')

    try {
      const resposta = await fetch(
        `http://localhost:3000/conversas/${conversaId}/transferir`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      )

      if (!resposta.ok) {
        const dados: { mensagem?: string } = await resposta.json()

        throw new Error(
          dados.mensagem || 'Não foi possível chamar um analista.',
        )
      }

      const dados: {
        conversa: { status: string }
        mensagem?: MensagemTransferencia
      } = await resposta.json()

      onTransferir(dados.conversa.status, dados.mensagem)
    } catch (erroCapturado) {
      setErro(
        erroCapturado instanceof Error
          ? erroCapturado.message
          : 'Não foi possível chamar um analista.',
      )
    } finally {
      setTransferindo(false)
    }
  }

  if (
    status === 'AGUARDANDO_ANALISTA' ||
    status === 'COM_ANALISTA'
  ) {
    return (
      <div
        role="status"
        className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3"
      >
        <p className="text-sm font-medium text-amber-900">
          {status === 'COM_ANALISTA'
            ? 'Um analista assumiu seu atendimento'
            : 'Sua conversa aguarda um analista'}
        </p>

        <p className="mt-1 text-xs text-amber-800">
          O assistente está pausado. Você pode acrescentar informações
          pelo chat.
        </p>
      </div>
    )
  }

  if (status === 'ENCERRADA') {
  return (
    <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-medium text-slate-700">
        Este atendimento foi encerrado.
      </p>

      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-3 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white"
      >
        Iniciar novo atendimento
      </button>
    </div>
  )
}

  if (status !== 'COM_AGENTE') {
    return null
  }

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={transferir}
        disabled={transferindo || enviandoMensagem}
        className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {transferindo ? 'Encaminhando...' : 'Falar com um analista'}
      </button>

      {erro && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {erro}
        </p>
      )}
    </div>
  )
}

export default AtendimentoHumano