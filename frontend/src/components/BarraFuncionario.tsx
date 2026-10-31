import { NavLink } from 'react-router-dom'

type Props = { usuario: { nome: string; email: string; papel?: string }; onSair: () => void }

export default function BarraFuncionario({ usuario, onSair }: Props) {
  const iniciais = usuario.nome.split(' ').filter(Boolean).slice(0, 2).map((parte) => parte[0]).join('')
  const destino = usuario.papel === 'ANALISTA' ? '/analista' : '/atendimento'
  const estilo = ({ isActive }: { isActive: boolean }) => `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${isActive ? 'bg-blue-50 font-medium text-blue-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`
  return <aside className="hidden min-h-screen w-52 shrink-0 flex-col border-r border-slate-200 bg-white p-3 sm:flex">
    <NavLink to={destino} className="mb-8 flex items-center gap-2 px-2 py-2 font-bold text-slate-800"><span className="text-2xl font-black text-blue-600">N</span>Nexo Assist</NavLink>
    <nav aria-label="Navegação principal" className="space-y-1">
      <NavLink to={destino} className={estilo}><svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 4h16v12H9l-5 4V4Z" /></svg>{usuario.papel === 'ANALISTA' ? 'Conversas' : 'Atendimento'}</NavLink>
      <NavLink to="/perfil" className={estilo}><svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="8" r="4" /><path d="M5 21v-2a7 7 0 0 1 14 0v2" /></svg>Meu perfil</NavLink>
    </nav>
    <div className="mt-auto border-t border-slate-100 px-2 pt-4">
      <div className="flex items-center gap-2"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">{iniciais}</span><div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-700">{usuario.nome}</p><p className="mt-1 truncate text-[10px] text-slate-400" title={usuario.email}>{usuario.email}</p></div></div>
      <button type="button" onClick={onSair} className="mt-4 text-xs text-slate-500 hover:text-blue-600">Sair da conta</button>
    </div>
  </aside>
}
