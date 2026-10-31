import { useEffect, useState } from 'react'
type Chamado = { id: string; numero: string; titulo: string; status: string; prioridade: string; prazo: { dataLimite: string; vencido: boolean } }
export default function PainelChamados({ token, atualizacao, desabilitado, onSelecionar }: {
  token: string | null; atualizacao: number; desabilitado: boolean; onSelecionar: (texto: string) => void
}) {
  const [chamados, setChamados] = useState<Chamado[]>([])
  const [erro, setErro] = useState('')
  useEffect(() => {
    if (!token) return
    const controller = new AbortController()
    void fetch('http://localhost:3000/chamados', { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then(async (resposta) => {
        if (!resposta.ok) throw new Error('Não foi possível consultar seus chamados. Tente atualizar a página em alguns segundos.')
        const dados = await resposta.json() as Chamado[]
        setChamados(dados); setErro('')
      }).catch((erro: unknown) => { if (!controller.signal.aborted) setErro(erro instanceof Error ? erro.message : 'Falha ao consultar chamados.') })
    return () => controller.abort()
  }, [token, atualizacao])
  return <details className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
    <summary className="cursor-pointer text-sm font-medium">Meus chamados · {chamados.length}</summary>
    {erro ? <p role="alert" className="mt-3 text-sm text-amber-700">{erro}</p> : <div className="mt-3 grid gap-3 sm:grid-cols-2">
      {chamados.map((chamado) => <button type="button" key={chamado.id} disabled={desabilitado} onClick={() => onSelecionar(`Quero consultar o chamado ${chamado.numero}: ${chamado.titulo}.`)} className="rounded-lg border border-slate-200 p-3 text-left text-sm hover:border-blue-400 disabled:opacity-60">
        <span className="block text-xs text-slate-500">{chamado.numero}</span><strong className="mt-1 block">{chamado.titulo}</strong>
        <span className="mt-1 block">{chamado.status.replaceAll('_', ' ')} · {chamado.prioridade.replace('Media', 'Média').replace('Critica', 'Crítica')}</span>
        <span className={chamado.prazo.vencido ? 'mt-1 block text-red-700' : 'mt-1 block text-slate-500'}>{chamado.prazo.vencido ? 'Prazo vencido: ' : 'Prazo: '}{new Date(chamado.prazo.dataLimite).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</span>
      </button>)}
      {chamados.length === 0 && <p className="text-sm text-slate-500">Nenhum chamado cadastrado.</p>}
    </div>}
  </details>
}
