import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

function Login() {
  const navigate = useNavigate()
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [manterConectado, setManterConectado] = useState(true)

async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault()

  setErro('')
  setCarregando(true)

  try {
    const resposta = await fetch('http://localhost:3000/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, senha }),
    })

    const dados = await resposta.json()

    if (!resposta.ok) {
      setErro(dados.mensagem || 'Não foi possível entrar.')
      return
    }

    const armazenamento = manterConectado ? localStorage : sessionStorage

    // Remove uma sessão anterior antes de salvar a nova.
    localStorage.removeItem('nexo-token')
    localStorage.removeItem('nexo-usuario')
    sessionStorage.removeItem('nexo-token')
    sessionStorage.removeItem('nexo-usuario')

    armazenamento.setItem('nexo-token', dados.token)
    armazenamento.setItem('nexo-usuario', JSON.stringify(dados.usuario))

    navigate('/atendimento')
  } catch {
    setErro('Não foi possível conectar ao servidor. Verifique se ele está ligado.')
  } finally {
    setCarregando(false)
  }
}

  return (
    <main className="min-h-screen lg:grid lg:grid-cols-[55%_45%]">
      
      {/* Apresentação */}
      <section className="flex min-h-[420px] flex-col bg-[#182230] px-7 py-8 text-white sm:px-12 lg:min-h-screen lg:px-14">
        <div className="flex items-center gap-2 text-sm font-bold">
          <span className="text-2xl font-black">N</span>
          <span>Nexo Assist</span>
        </div>

        <div className="my-auto max-w-xl py-12">
          <p className="mb-4 text-xs text-slate-400">
            Service desk de TI da Nexo
          </p>

          <h1 className="font-serif text-4xl leading-tight sm:text-5xl">
            Seu problema de TI, resolvido em uma conversa.
          </h1>

          <p className="mt-5 max-w-md text-sm leading-6 text-slate-400">
            Descreva o que está acontecendo. O assistente consulta seus
            chamados, busca na central de ajuda e chama um analista quando
            precisa.
          </p>

          <div className="mx-auto mt-10 max-w-md rounded-2xl border border-white/5 bg-white/5 p-5">
            <div className="ml-auto w-fit rounded-lg bg-white px-4 py-2 text-xs text-slate-800">
              Meu notebook não conecta na VPN. Erro 809.
            </div>

            <p className="mt-5 text-xs font-semibold text-slate-300">
              Nexo Assist
              <span className="ml-2 font-normal text-slate-500">
                consultou seus chamados · criou um chamado
              </span>
            </p>

            <div className="mt-2 w-fit rounded-lg bg-slate-600/40 px-4 py-3 text-xs leading-5 text-slate-200">
              Pronto, abri o chamado com prioridade alta. Um analista fala com
              você em até 4 horas úteis.
            </div>

            <div className="mt-3 w-fit rounded-full bg-white px-3 py-2 text-xs text-slate-700">
              <span className="mr-2 text-amber-500">●</span>
              <strong>INC-20987</strong> · Rede e VPN · Alta · em até 4 h
            </div>
          </div>
        </div>

        <div className="grid max-w-xl grid-cols-3 gap-4 border-t border-white/10 pt-6">
          <div>
            <p className="font-serif text-2xl">8 s</p>
            <p className="mt-1 text-xs text-slate-400">
              primeira resposta, em média
            </p>
          </div>

          <div className="border-l border-white/10 pl-4">
            <p className="font-serif text-2xl">72%</p>
            <p className="mt-1 text-xs text-slate-400">resolvidos sem fila</p>
          </div>

          <div className="border-l border-white/10 pl-4">
            <p className="font-serif text-2xl">
              6 <span className="text-sm text-emerald-400">●</span>
            </p>
            <p className="mt-1 text-xs text-slate-400">analistas online agora</p>
          </div>
        </div>
      </section>

      {/* Login */}
      <section className="flex min-h-[600px] flex-col bg-white px-7 py-7 text-slate-800 sm:px-12 lg:min-h-screen">
        <p className="text-right text-xs text-slate-500">
          Problemas para entrar?{' '}
          <span className="font-semibold text-blue-600">
            Ligue no ramal 4000
          </span>
        </p>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-14">
          <h2 className="font-serif text-3xl">Entrar</h2>
          <p className="mt-2 text-sm text-slate-500">
            Use seu e-mail corporativo e a senha da rede Nexo.
          </p>

          <form onSubmit={handleLogin} className="mt-8 space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-xs font-semibold"
              >
                E-mail corporativo
              </label>

              <input
                id="email"
                type="email"
                placeholder="ana.souza@nexo.com.br"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="w-full rounded-lg border border-slate-200 px-3 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="senha" className="text-xs font-semibold">
                  Senha
                </label>

                <span className="text-xs text-blue-600">
                  Esqueci minha senha
                </span>
              </div>

              <div className="flex rounded-lg border border-slate-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
                <input
                  id="senha"
                  type={mostrarSenha ? 'text' : 'password'}
                  placeholder="Digite sua senha"
                  value={senha}
                  onChange={(event) => setSenha(event.target.value)}
                  required
                  className="min-w-0 flex-1 px-3 py-3 text-sm outline-none"
                />

                <button
                  type="button"
                  onClick={() => setMostrarSenha(!mostrarSenha)}
                  className="px-3 text-xs font-medium text-slate-500 hover:text-blue-600"
                >
                  {mostrarSenha ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={manterConectado}
                onChange={(event) => setManterConectado(event.target.checked)}
                className="h-4 w-4 accent-blue-600"
              />
              Manter conectado neste computador
            </label>

            {erro && (
              <p role='alert' className="text-sm text-red-600">
                {erro}
              </p>
            )}

            <button
              type="submit"
              disabled={carregando}
              className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {carregando ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>

        <footer className="flex flex-wrap justify-between gap-3 text-xs text-slate-400">
          <span>© 2026 Nexo · Service desk de TI</span>
          <span>Privacidade e uso de dados</span>
        </footer>
      </section>
    </main>
  )
}

export default Login