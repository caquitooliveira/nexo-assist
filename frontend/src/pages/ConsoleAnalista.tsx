import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { useNavigate } from 'react-router-dom'

type Usuario = {
  id: string
  nome: string
  papel: string
}

type Mensagem = {
  id: string
  autor: string
  texto: string
  criadoEm: string
}

type ItemConversa = {
  id: string
  status: string
  atualizadoEm: string
  analistaId: string | null
  usuario: {
    nome: string
    email: string
  }
  mensagens: { texto: string }[]
}

type Chamado = {
  id: string
  numero: string
  titulo: string
  categoria: string
  prioridade: string
  status: string
  prazo: {
    dataLimite: string
    vencido: boolean
  }
}

type DetalheConversa = {
  id: string
  status: string
  resumo: string | null
  analistaId: string | null
  atualizadoEm: string
  usuario: {
    id: string
    nome: string
    email: string
  }
  analista: {
    id: string
    nome: string
  } | null
  mensagens: Mensagem[]
  chamados: Chamado[]
}

type ResultadoEstado = {
  conversa: {
    status: string
    analistaId: string | null
    atualizadoEm: string
  }
  mensagem: Mensagem
}

const STATUS: Record<string, string> = {
  COM_AGENTE: 'Com o assistente',
  AGUARDANDO_ANALISTA: 'Aguardando analista',
  COM_ANALISTA: 'Em atendimento',
  ENCERRADA: 'Encerrada',
}

const PRIORIDADES: Record<string, string> = {
  Critica: 'Crítica',
  Alta: 'Alta',
  Media: 'Média',
  Baixa: 'Baixa',
}

class ErroAPI extends Error {
  status: number

  constructor(status: number, mensagem: string) {
    super(mensagem)
    this.status = status
  }
}

function limparSessao() {
  localStorage.removeItem('nexo-token')
  localStorage.removeItem('nexo-usuario')
  sessionStorage.removeItem('nexo-token')
  sessionStorage.removeItem('nexo-usuario')
}

async function api<T>(
  caminho: string,
  opcoes: {
    metodo?: string
    corpo?: unknown
    sinal?: AbortSignal
  } = {},
): Promise<T> {
  const token =
    localStorage.getItem('nexo-token') ||
    sessionStorage.getItem('nexo-token')

  if (!token) {
    throw new ErroAPI(401, 'Faça login novamente.')
  }

  const resposta = await fetch(`http://localhost:3000${caminho}`, {
    method: opcoes.metodo ?? 'GET',
    signal: opcoes.sinal,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(opcoes.corpo !== undefined
        ? { 'Content-Type': 'application/json' }
        : {}),
    },
    body:
      opcoes.corpo !== undefined
        ? JSON.stringify(opcoes.corpo)
        : undefined,
  })

  if (!resposta.ok) {
    const dados: { mensagem?: string } = await resposta
      .json()
      .catch(() => ({}))

    throw new ErroAPI(
      resposta.status,
      dados.mensagem || 'Não foi possível concluir a operação.',
    )
  }

  return resposta.json()
}

function ConsoleAnalista() {
  const navigate = useNavigate()

  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [conversas, setConversas] = useState<ItemConversa[]>([])
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null)
  const [detalhe, setDetalhe] = useState<DetalheConversa | null>(null)
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState('TODAS')
  const [texto, setTexto] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')

  const fimHistorico = useRef<HTMLDivElement>(null)

  const tratarErro = useCallback(
    (erroCapturado: unknown) => {
      if (erroCapturado instanceof ErroAPI) {
        if (erroCapturado.status === 401) {
          limparSessao()
          navigate('/', { replace: true })
          return
        }

        if (erroCapturado.status === 403) {
          navigate('/atendimento', { replace: true })
          return
        }
      }

      setErro(
        erroCapturado instanceof Error
          ? erroCapturado.message
          : 'Não foi possível concluir a operação.',
      )
    },
    [navigate],
  )

  useEffect(() => {
    const controller = new AbortController()

    async function verificarAcesso() {
      try {
        const dados = await api<Usuario>('/auth/me', {
          sinal: controller.signal,
        })

        if (dados.papel !== 'ANALISTA') {
          navigate('/atendimento', { replace: true })
          return
        }

        setUsuario(dados)
      } catch (erroCapturado) {
        if (!controller.signal.aborted) {
          tratarErro(erroCapturado)
        }
      } finally {
        if (!controller.signal.aborted) {
          setCarregando(false)
        }
      }
    }

    void verificarAcesso()

    return () => controller.abort()
  }, [navigate, tratarErro])

  useEffect(() => {
    if (!usuario || ocupado) return

    const controller = new AbortController()
    let proximaAtualizacao: ReturnType<typeof setTimeout> | undefined

    async function atualizar() {
      try {
        const [lista, conversa] = await Promise.all([
          api<ItemConversa[]>('/analista/conversas', {
            sinal: controller.signal,
          }),
          selecionadaId
            ? api<DetalheConversa>(
                `/analista/conversas/${selecionadaId}`,
                { sinal: controller.signal },
              )
            : Promise.resolve(null),
        ])

        if (controller.signal.aborted) return

        setConversas(lista)

        if (!selecionadaId && lista.length > 0) {
          const primeira =
            lista.find(
              (item) => item.status === 'AGUARDANDO_ANALISTA',
            ) ?? lista[0]

          setSelecionadaId(primeira.id)
        }

        if (conversa) {
          setDetalhe(conversa)
        }
      } catch (erroCapturado) {
        if (!controller.signal.aborted) {
          tratarErro(erroCapturado)
        }
      } finally {
        if (!controller.signal.aborted) {
          proximaAtualizacao = setTimeout(atualizar, 4000)
        }
      }
    }

    void atualizar()

    return () => {
      controller.abort()

      if (proximaAtualizacao) {
        clearTimeout(proximaAtualizacao)
      }
    }
  }, [usuario, selecionadaId, ocupado, tratarErro])

  useEffect(() => {
    fimHistorico.current?.scrollIntoView({
      block: 'nearest',
    })
  }, [detalhe?.id, detalhe?.mensagens.length])

  function sair() {
    limparSessao()
    navigate('/', { replace: true })
  }

  async function alterarEstado(
    acao: 'ASSUMIR' | 'DEVOLVER' | 'ENCERRAR',
  ) {
    if (!selecionadaId || ocupado) return

    setOcupado(true)
    setErro('')

    try {
      const resultado = await api<ResultadoEstado>(
        `/analista/conversas/${selecionadaId}/estado`,
        {
          metodo: 'PATCH',
          corpo: { acao },
        },
      )

      setDetalhe((anterior) => {
        if (!anterior || anterior.id !== selecionadaId) {
          return anterior
        }

        return {
          ...anterior,
          ...resultado.conversa,
          mensagens: [...anterior.mensagens, resultado.mensagem],
        }
      })
    } catch (erroCapturado) {
      tratarErro(erroCapturado)
    } finally {
      setOcupado(false)
    }
  }

  async function enviarMensagem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selecionadaId || !texto.trim() || ocupado) return

    setOcupado(true)
    setErro('')

    try {
      const mensagem = await api<Mensagem>(
        `/analista/conversas/${selecionadaId}/mensagens`,
        {
          metodo: 'POST',
          corpo: { texto: texto.trim() },
        },
      )

      setDetalhe((anterior) => {
        if (!anterior || anterior.id !== selecionadaId) {
          return anterior
        }

        return {
          ...anterior,
          atualizadoEm: mensagem.criadoEm,
          mensagens: [...anterior.mensagens, mensagem],
        }
      })

      setTexto('')
    } catch (erroCapturado) {
      tratarErro(erroCapturado)
    } finally {
      setOcupado(false)
    }
  }

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        Verificando acesso...
      </div>
    )
  }

  if (!usuario) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p role="alert" className="text-sm text-red-600">
          {erro || 'Não foi possível abrir o console.'}
        </p>

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white"
        >
          Tentar novamente
        </button>
      </div>
    )
  }

  const ativa =
    detalhe?.id === selecionadaId ? detalhe : null

  const minhaConversa =
    ativa?.status === 'COM_ANALISTA' &&
    ativa.analistaId === usuario.id

  const conversasFiltradas = conversas.filter((conversa) => {
    const correspondeBusca =
      `${conversa.usuario.nome} ${conversa.usuario.email}`
        .toLowerCase()
        .includes(busca.toLowerCase())

    const correspondeFiltro =
      filtro === 'TODAS' ||
      (filtro === 'MINHAS'
        ? conversa.analistaId === usuario.id
        : conversa.status === filtro)

    return correspondeBusca && correspondeFiltro
  })

  return (
    <div className="flex h-screen flex-col bg-white text-slate-800">
      <header className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4">
        <div>
          <p className="font-semibold">
            <span className="mr-2 text-blue-600">N</span>
            Console do analista
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {usuario.nome}
          </p>
        </div>

        <button
          type="button"
          onClick={sair}
          className="text-sm text-slate-500 hover:text-blue-600"
        >
          Sair
        </button>
      </header>

      {erro && (
        <p
          role="alert"
          className="border-b border-red-100 bg-red-50 px-5 py-3 text-sm text-red-700"
        >
          {erro}
        </p>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[17rem_minmax(0,1fr)_19rem] lg:overflow-hidden">
        <aside className="overflow-y-auto border-r border-slate-200 p-4">
          <h1 className="mb-3 font-semibold">Conversas</h1>

          <input
            aria-label="Pesquisar funcionário"
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Pesquisar funcionário..."
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />

          <select
            aria-label="Filtrar conversas"
            value={filtro}
            onChange={(event) => setFiltro(event.target.value)}
            className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="TODAS">Todas</option>
            <option value="AGUARDANDO_ANALISTA">Aguardando analista</option>
            <option value="COM_ANALISTA">Em atendimento</option>
            <option value="MINHAS">Minhas</option>
            <option value="COM_AGENTE">Com o assistente</option>
            <option value="ENCERRADA">Encerradas</option>
          </select>

          <div className="mt-4 space-y-2">
            {conversasFiltradas.map((conversa) => (
              <button
                key={conversa.id}
                type="button"
                disabled={ocupado}
                onClick={() => {
                  setSelecionadaId(conversa.id)
                  setTexto('')
                  setErro('')
                }}
                className={`w-full rounded-lg border p-3 text-left disabled:opacity-60 ${
                  selecionadaId === conversa.id
                    ? 'border-blue-200 bg-blue-50'
                    : 'border-transparent hover:bg-slate-50'
                }`}
              >
                <p className="text-sm font-semibold">
                  {conversa.usuario.nome}
                </p>

                <p className="mt-1 truncate text-xs text-slate-500">
                  {conversa.mensagens[0]?.texto || 'Sem mensagens'}
                </p>

                <p className="mt-2 text-xs text-blue-600">
                  {STATUS[conversa.status] ?? conversa.status}
                </p>
              </button>
            ))}

            {conversasFiltradas.length === 0 && (
              <p className="text-sm text-slate-500">
                Nenhuma conversa encontrada.
              </p>
            )}
          </div>
        </aside>

        <main className="flex min-h-[30rem] min-w-0 flex-col lg:min-h-0">
          {!ativa ? (
            <div className="flex flex-1 items-center justify-center p-8 text-sm text-slate-500">
              {selecionadaId
                ? 'Carregando conversa...'
                : 'Selecione uma conversa para atender.'}
            </div>
          ) : (
            <>
              <div className="shrink-0 border-b border-slate-200 p-4">
                <p className="font-semibold">{ativa.usuario.nome}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {ativa.usuario.email}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs">
                    {STATUS[ativa.status] ?? ativa.status}
                  </span>

                  {ativa.status === 'AGUARDANDO_ANALISTA' && (
                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() => {
                        void alterarEstado('ASSUMIR')
                      }}
                      className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      Assumir atendimento
                    </button>
                  )}

                  {minhaConversa && (
                    <>
                      <button
                        type="button"
                        disabled={ocupado}
                        onClick={() => {
                          void alterarEstado('DEVOLVER')
                        }}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs disabled:opacity-50"
                      >
                        Devolver ao agente
                      </button>

                      <button
                        type="button"
                        disabled={ocupado}
                        onClick={() => {
                          void alterarEstado('ENCERRAR')
                        }}
                        className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 disabled:opacity-50"
                      >
                        Encerrar conversa
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-slate-50 p-5">
                {ativa.mensagens.map((mensagem) => {
                  if (mensagem.autor === 'SISTEMA') {
                    return (
                      <p
                        key={mensagem.id}
                        className="text-center text-xs text-slate-500"
                      >
                        {mensagem.texto}
                      </p>
                    )
                  }

                  const funcionario =
                    mensagem.autor === 'FUNCIONARIO'

                  return (
                    <div
                      key={mensagem.id}
                      className={`max-w-[90%] ${
                        funcionario ? 'mr-auto' : 'ml-auto'
                      }`}
                    >
                      <p className="mb-1 text-xs text-slate-500">
                        {funcionario
                          ? ativa.usuario.nome
                          : mensagem.autor === 'ANALISTA'
                            ? 'Analista'
                            : 'Nexo Assist'}
                      </p>

                      <div
                        className={`whitespace-pre-wrap break-words rounded-xl border px-4 py-3 text-sm ${
                          funcionario
                            ? 'border-slate-200 bg-white'
                            : mensagem.autor === 'ANALISTA'
                              ? 'border-emerald-100 bg-emerald-50'
                              : 'border-blue-100 bg-blue-50'
                        }`}
                      >
                        {mensagem.texto}
                      </div>
                    </div>
                  )
                })}

                <div ref={fimHistorico} />
              </div>

              <form
                onSubmit={enviarMensagem}
                className="flex shrink-0 gap-2 border-t border-slate-200 p-4"
              >
                <input
                  aria-label="Mensagem do analista"
                  value={texto}
                  onChange={(event) => setTexto(event.target.value)}
                  disabled={!minhaConversa || ocupado}
                  maxLength={2000}
                  placeholder={
                    minhaConversa
                      ? 'Escreva sua resposta...'
                      : 'Assuma o atendimento para responder'
                  }
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none disabled:bg-slate-50"
                />

                <button
                  type="submit"
                  disabled={!minhaConversa || ocupado || !texto.trim()}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {ocupado ? 'Aguarde...' : 'Enviar'}
                </button>
              </form>
            </>
          )}
        </main>

        <aside className="overflow-y-auto border-l border-slate-200 p-4">
          <h2 className="font-semibold">Contexto e chamados</h2>

          {ativa && (
            <>
              <details className="mt-4 rounded-lg border border-slate-200 p-3">
                <summary className="cursor-pointer text-sm font-medium">
                  Contexto recebido
                </summary>
                <p className="mt-3 whitespace-pre-wrap break-words text-xs leading-5 text-slate-600">
                  {ativa.resumo || 'Sem resumo disponível.'}
                </p>
              </details>

              <div className="mt-4 space-y-3">
                {ativa.chamados.map((chamado) => (
                  <article
                    key={chamado.id}
                    className="rounded-lg border border-slate-200 p-3"
                  >
                    <p className="text-xs text-slate-500">
                      {chamado.numero}
                    </p>

                    <h3 className="mt-1 text-sm font-semibold">
                      {chamado.titulo}
                    </h3>

                    <p className="mt-2 text-xs text-slate-600">
                      {chamado.categoria} ·{' '}
                      {PRIORIDADES[chamado.prioridade] ??
                        chamado.prioridade}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {chamado.status.replaceAll('_', ' ')}
                    </p>

                    <p
                      className={`mt-2 text-xs ${
                        chamado.prazo.vencido
                          ? 'font-medium text-red-600'
                          : 'text-slate-500'
                      }`}
                    >
                      {chamado.prazo.vencido
                        ? 'Prazo vencido'
                        : 'Prazo'}{' '}
                      ·{' '}
                      {new Date(
                        chamado.prazo.dataLimite,
                      ).toLocaleString('pt-BR', {
                        timeZone: 'America/Sao_Paulo',
                      })}
                    </p>
                  </article>
                ))}

                {ativa.chamados.length === 0 && (
                  <p className="text-sm text-slate-500">
                    Este funcionário não possui chamados.
                  </p>
                )}
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  )
}

export default ConsoleAnalista