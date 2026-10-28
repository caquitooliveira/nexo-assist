import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

type Usuario = {
  id: string
  nome: string
  email: string
}

type Mensagem = {
  id: string
  autor: string
  texto: string
}

type Conversa = {
  id: string
  status: string
  mensagens: Mensagem[]
}

const API_URL = 'http://localhost:3000'

function obterToken() {
  return (
    localStorage.getItem('nexo-token') ||
    sessionStorage.getItem('nexo-token')
  )
}

function limparSessao() {
  localStorage.removeItem('nexo-token')
  localStorage.removeItem('nexo-usuario')
  sessionStorage.removeItem('nexo-token')
  sessionStorage.removeItem('nexo-usuario')
}

function Atendimento() {
  const navigate = useNavigate()

  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [conversa, setConversa] = useState<Conversa | null>(null)
  const [texto, setTexto] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    async function carregarAtendimento() {
      const token = obterToken()

      if (!token) {
        navigate('/', { replace: true })
        return
      }

      const headers = {
        Authorization: `Bearer ${token}`,
      }

      try {
        const respostaUsuario = await fetch(`${API_URL}/auth/me`, {
          headers,
          signal: controller.signal,
        })

        if (respostaUsuario.status === 401) {
          limparSessao()
          navigate('/', { replace: true })
          return
        }

        if (!respostaUsuario.ok) {
          throw new Error('Não foi possível verificar sua sessão.')
        }

        const usuarioCarregado: Usuario = await respostaUsuario.json()

        const respostaConversa = await fetch(`${API_URL}/conversas/atual`, {
          method: 'POST',
          headers,
          signal: controller.signal,
        })

        if (respostaConversa.status === 401) {
          limparSessao()
          navigate('/', { replace: true })
          return
        }

        if (!respostaConversa.ok) {
          throw new Error('Não foi possível carregar a conversa.')
        }

        const conversaCarregada: Conversa = await respostaConversa.json()

        setUsuario(usuarioCarregado)
        setConversa(conversaCarregada)
      } catch (erroCapturado) {
        if (controller.signal.aborted) return

        console.error('Erro ao carregar atendimento:', erroCapturado)
        setErro('Não foi possível carregar o atendimento. Verifique o servidor.')
      } finally {
        if (!controller.signal.aborted) {
          setCarregando(false)
        }
      }
    }

    void carregarAtendimento()

    return () => controller.abort()
  }, [navigate])

  function sair() {
    limparSessao()
    navigate('/', { replace: true })
  }

  async function enviarMensagem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const textoLimpo = texto.trim()
    const token = obterToken()

    if (!textoLimpo || !token || !conversa || enviando) return

    setErro('')
    setEnviando(true)

    try {
      const resposta = await fetch(
        `${API_URL}/conversas/${conversa.id}/mensagens`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ texto: textoLimpo }),
        },
      )

      if (resposta.status === 401) {
        limparSessao()
        navigate('/', { replace: true })
        return
      }

      if (!resposta.ok) {
        const dados: { mensagem?: string } = await resposta.json()
        throw new Error(dados.mensagem || 'Não foi possível enviar a mensagem.')
      }

      const mensagemSalva: Mensagem = await resposta.json()

      setConversa((anterior) => {
        if (!anterior) return anterior

        return {
          ...anterior,
          mensagens: [...anterior.mensagens, mensagemSalva],
        }
      })

      setTexto('')
    } catch (erroCapturado) {
      setErro(
        erroCapturado instanceof Error
          ? erroCapturado.message
          : 'Não foi possível enviar a mensagem.',
      )
    } finally {
      setEnviando(false)
    }
  }

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        Carregando atendimento...
      </div>
    )
  }

  if (!usuario || !conversa) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-red-600">
          {erro || 'Não foi possível carregar o atendimento.'}
        </p>

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Tentar novamente
        </button>
      </div>
    )
  }

  const totalMensagens = conversa.mensagens.filter(
    (mensagem) => mensagem.autor === 'FUNCIONARIO',
  ).length

  const limiteAtingido = totalMensagens >= 30

  return (
    <div className="flex min-h-screen bg-white text-slate-800">
      <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 p-4">
        <div className="mb-10 flex items-center gap-2 text-sm font-bold">
          <span className="text-2xl font-black text-blue-600">N</span>
          <span>Nexo Assist</span>
        </div>

        <div className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-600">
          Atendimento
        </div>

        <div className="mt-auto border-t border-slate-200 pt-4">
          <p className="text-sm font-medium">{usuario.nome}</p>
          <p className="mt-1 break-all text-xs text-slate-500">
            {usuario.email}
          </p>

          <button
            type="button"
            onClick={sair}
            className="mt-4 text-sm text-slate-500 hover:text-blue-600"
          >
            Sair
          </button>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 px-6">
          <p className="text-xs text-slate-500">
            Service desk de TI <span className="mx-2">›</span>
            <span className="font-medium text-slate-800">Atendimento</span>
          </p>

          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700">
            Atendimento
          </span>
        </header>

        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6">
          <div aria-live="polite" className="flex flex-1 flex-col gap-5 py-8">
            {conversa.mensagens.length === 0 && (
              <p className="text-sm text-slate-500">
                Descreva como podemos ajudar com seu problema de TI.
              </p>
            )}

            {conversa.mensagens.map((mensagem) => {
              const enviadaPeloFuncionario = mensagem.autor === 'FUNCIONARIO'

              return (
                <div
                  key={mensagem.id}
                  className={
                    enviadaPeloFuncionario
                      ? 'ml-auto max-w-[85%]'
                      : 'mr-auto max-w-[85%]'
                  }
                >
                  {!enviadaPeloFuncionario && (
                    <p className="mb-2 text-xs font-semibold text-slate-600">
                      {mensagem.autor === 'ANALISTA'
                        ? 'Analista'
                        : 'Nexo Assist'}
                    </p>
                  )}

                  <div
                    className={
                      enviadaPeloFuncionario
                        ? 'rounded-xl bg-slate-800 px-4 py-3 text-sm text-white'
                        : 'rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm'
                    }
                  >
                    {mensagem.texto}
                  </div>
                </div>
              )
            })}
          </div>

          {erro && (
            <p role="alert" className="mb-2 text-sm text-red-600">
              {erro}
            </p>
          )}

          {limiteAtingido && (
            <p className="mb-2 text-sm text-amber-700">
              Você atingiu o limite de mensagens desta conversa.
            </p>
          )}

          <form
            onSubmit={enviarMensagem}
            className="flex gap-2 rounded-xl border border-slate-200 p-2 shadow-sm"
          >
            <label htmlFor="mensagem" className="sr-only">
              Escreva sua mensagem
            </label>

            <input
              id="mensagem"
              value={texto}
              onChange={(event) => setTexto(event.target.value)}
              placeholder="Escreva para o Nexo..."
              maxLength={2000}
              disabled={enviando || limiteAtingido}
              className="min-w-0 flex-1 px-3 py-2 text-sm outline-none disabled:opacity-60"
            />

            <button
              type="submit"
              disabled={enviando || limiteAtingido || !texto.trim()}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {enviando ? 'Enviando...' : 'Enviar'}
            </button>
          </form>

          <p className="mb-6 mt-2 text-right text-xs text-slate-400">
            {totalMensagens}/30 mensagens nesta sessão
          </p>
        </div>
      </main>
    </div>
  )
}

export default Atendimento