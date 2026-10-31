import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import BarraFuncionario from '../components/BarraFuncionario'

type Usuario = { id: string; nome: string; email: string; papel: string }

export default function MeuPerfil() {
  const navigate = useNavigate()
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState(false)
  const [carregando, setCarregando] = useState(true)

  function sair() {
    for (const armazenamento of [localStorage, sessionStorage]) {
      armazenamento.removeItem('nexo-token')
      armazenamento.removeItem('nexo-usuario')
    }
    navigate('/', { replace: true })
  }

  useEffect(() => {
    const controller = new AbortController()
    const token = localStorage.getItem('nexo-token') || sessionStorage.getItem('nexo-token')
    if (!token) { navigate('/', { replace: true }); return }
    async function carregar() {
      try {
        const resposta = await fetch('http://localhost:3000/auth/me', {
          headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
        })
        if (resposta.status === 401) {
          for (const armazenamento of [localStorage, sessionStorage]) {
            armazenamento.removeItem('nexo-token'); armazenamento.removeItem('nexo-usuario')
          }
          navigate('/', { replace: true }); return
        }
        if (!resposta.ok) throw new Error('Não foi possível carregar seu perfil. Confira se o servidor está rodando.')
        const dados = await resposta.json() as Usuario
        if (!controller.signal.aborted) setUsuario(dados)
      } catch (erro) {
        if (!controller.signal.aborted) setErro(erro instanceof Error ? erro.message : 'Não foi possível carregar o perfil.')
      } finally { if (!controller.signal.aborted) setCarregando(false) }
    }
    void carregar()
    return () => controller.abort()
  }, [navigate])

  if (carregando) return <main className="flex min-h-screen items-center justify-center text-sm text-slate-500" role="status">Carregando seu perfil...</main>
  if (!usuario) return <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6"><p role="alert" className="text-sm text-red-700">{erro}</p><button type="button" onClick={() => window.location.reload()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white">Tentar novamente</button></main>

  const destino = usuario.papel === 'ANALISTA' ? '/analista' : '/atendimento'
  return <div className="flex min-h-screen bg-white text-slate-800">
    <BarraFuncionario usuario={usuario} onSair={sair} />
    <main className="min-w-0 flex-1">
      <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-3">
        <p className="text-xs text-slate-400">Service desk de TI <span className="mx-2">›</span><span className="font-medium text-slate-700">Meu perfil</span></p>
        <div className="flex gap-4 text-xs sm:hidden"><Link to={destino} className="text-blue-600">{usuario.papel === 'ANALISTA' ? 'Conversas' : 'Atendimento'}</Link><button type="button" onClick={sair} className="text-slate-500">Sair</button></div>
      </header>
      <section aria-labelledby="titulo-perfil" className="mx-auto w-full max-w-2xl px-6 py-12 sm:py-14">
        <h1 id="titulo-perfil" className="text-xl font-semibold tracking-tight">Meu perfil</h1>
        <p className="mt-2 text-sm text-slate-500">Seus dados de acesso ao service desk de TI.</p>
        <dl className="mt-7 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-2 border-b border-slate-100 px-5 py-5 sm:grid-cols-[10rem_1fr]"><dt className="text-xs text-slate-500">Nome</dt><dd className="text-sm font-medium">{usuario.nome}</dd></div>
          <div className="grid gap-2 px-5 py-5 sm:grid-cols-[10rem_1fr]"><dt className="text-xs text-slate-500">E-mail corporativo</dt><dd className="flex flex-wrap items-center justify-between gap-3"><span className="break-all text-sm">{usuario.email}</span><span className="inline-flex items-center gap-1 text-[11px] text-slate-400"><svg aria-hidden="true" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>Gerenciado pela TI</span></dd></div>
        </dl>
        <section aria-labelledby="titulo-senha" className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-3 p-5"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-slate-400"><svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="15" cy="8" r="4"/><path d="m12 11-8 8v2h3v-3h3v-3l3-3"/></svg></span><div className="flex-1"><h2 id="titulo-senha" className="text-sm font-medium">Senha</h2><p className="mt-1 text-xs text-slate-500">Acesso de demonstração</p></div><button type="button" onClick={() => setAviso(true)} aria-describedby="explicacao-senha" className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:border-blue-300 hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">Redefinir senha</button></div>
          <p id="explicacao-senha" className="border-t border-slate-100 bg-slate-50 px-5 py-3 text-xs leading-5 text-slate-500">Neste ambiente, qualquer senha preenchida é aceita. O e-mail cadastrado identifica seu acesso.</p>
          {aviso && <div role="status" className="border-t border-blue-100 bg-blue-50 px-5 py-4 text-xs leading-5 text-blue-800">A redefinição de senha não está disponível nesta demonstração. Nenhum e-mail foi enviado. Em um ambiente corporativo, essa alteração seria gerenciada pela TI.</div>}
        </section>
      </section>
    </main>
  </div>
}
