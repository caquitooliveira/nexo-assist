import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

type Mensagem = {
  id: number
  autor: 'funcionario' | 'assistente'
  texto: string
}

type Usuario = {
  id: string
  nome: string
  email: string
}

function Atendimento() {
  const navigate = useNavigate()
  const [texto, setTexto] = useState('')
  const [mensagens, setMensagens] = useState<Mensagem[]>([
    {
      id: 1,
      autor: 'assistente',
      texto: 'Olá! Sou o Nexo Assist. Como posso ajudar você hoje?',
    },
    
  ])

  const [usuario, setUsuario] = useState<Usuario | null>(null)
const [verificandoSessao, setVerificandoSessao] = useState(true)
const [erroSessao, setErroSessao] = useState('')

useEffect(() => {
  const controller = new AbortController()

  async function verificarSessao() {
    const token =
      localStorage.getItem('nexo-token') ||
      sessionStorage.getItem('nexo-token')

    if (!token) {
      navigate('/', { replace: true })
      return
    }

    try {
      const resposta = await fetch('http://localhost:3000/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      })

      if (resposta.status === 401) {
        localStorage.removeItem('nexo-token')
        localStorage.removeItem('nexo-usuario')
        sessionStorage.removeItem('nexo-token')
        sessionStorage.removeItem('nexo-usuario')

        navigate('/', { replace: true })
        return
      }

      if (!resposta.ok) {
        throw new Error('Não foi possível verificar a sessão.')
      }

      const dados: Usuario = await resposta.json()
      setUsuario(dados)
    } catch (erro) {
      if (controller.signal.aborted) return

      console.error('Erro ao verificar sessão:', erro)
      setErroSessao(
        'Não foi possível conectar ao servidor. Verifique se ele está ligado.',
      )
    } finally {
      if (!controller.signal.aborted) {
        setVerificandoSessao(false)
      }
    }
  }

  void verificarSessao()

  return () => controller.abort()
}, [navigate])

  function sair() {
  localStorage.removeItem('nexo-token')
  localStorage.removeItem('nexo-usuario')
  sessionStorage.removeItem('nexo-token')
  sessionStorage.removeItem('nexo-usuario')

  navigate('/')
}

  function enviarMensagem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const textoLimpo = texto.trim()

    if (!textoLimpo) return

    setMensagens((anteriores) => [
      ...anteriores,
      {
        id: Date.now(),
        autor: 'funcionario',
        texto: textoLimpo,
      },
    ])

    setTexto('')
  }

  if (verificandoSessao) {
  return (
    <div className="flex min-h-screen items-center justify-center text-slate-500">
      Verificando sessão...
    </div>
  )
}

if (erroSessao) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm text-red-600">{erroSessao}</p>

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
          <p className="text-sm font-medium">{usuario?.nome}</p>
          <p className="mt-1 break-all text-xs text-slate-500">
            {usuario?.email}
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

          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700">
            ● Assistente
          </span>
        </header>

        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6">
          <div
            aria-live="polite"
            className="flex flex-1 flex-col gap-5 py-8"
          >
            {mensagens.map((mensagem) => (
              <div
                key={mensagem.id}
                className={
                  mensagem.autor === 'funcionario'
                    ? 'ml-auto max-w-[85%]'
                    : 'mr-auto max-w-[85%]'
                }
              >
                {mensagem.autor === 'assistente' && (
                  <p className="mb-2 text-xs font-semibold text-slate-600">
                    Nexo Assist
                  </p>
                )}

                <div
                  className={
                    mensagem.autor === 'funcionario'
                      ? 'rounded-xl bg-slate-800 px-4 py-3 text-sm text-white'
                      : 'rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm'
                  }
                >
                  {mensagem.texto}
                </div>
              </div>
            ))}
          </div>

          <form
            onSubmit={enviarMensagem}
            className="mb-6 flex gap-2 rounded-xl border border-slate-200 p-2 shadow-sm"
          >
            <label htmlFor="mensagem" className="sr-only">
              Escreva sua mensagem
            </label>

            <input
              id="mensagem"
              value={texto}
              onChange={(event) => setTexto(event.target.value)}
              placeholder="Escreva para o Nexo..."
              className="min-w-0 flex-1 px-3 py-2 text-sm outline-none"
            />

            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Enviar
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}

export default Atendimento