import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import CartaoRascunho from '../components/CartaoRascunho'
import AtendimentoHumano from '../components/AtendimentoHumano'
import { useSincronizarConversa } from '../hooks/useSincronizarConversa'

type Usuario = {
  id: string
  nome: string
  email: string
  papel?: string
}

type AcaoAgente = {
  id: string
  nome: string
  entrada: string
  resultado: string
}

type Mensagem = {
  id: string
  autor: string
  texto: string
  entendimento?: string | null
  justificativa?: string | null
  seguranca?: 'ALTA' | 'MEDIA' | 'BAIXA' | null
  acoes?: AcaoAgente[]
}

type Conversa = {
  id: string
  status: string
  atualizadoEm: string
  mensagens: Mensagem[]
}

const API_URL = 'http://localhost:3000'

const STATUS_CONVERSA: Record<string, string> = {
  COM_AGENTE: 'Com o assistente',
  AGUARDANDO_ANALISTA: 'Aguardando analista',
  COM_ANALISTA: 'Em atendimento',
  ENCERRADA: 'Encerrada',
}

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

function adicionarMensagens(
  existentes: Mensagem[],
  novas: Mensagem[],
) {
  const mensagens = [...existentes]
  const ids = new Set(existentes.map((mensagem) => mensagem.id))

  for (const mensagem of novas) {
    if (!ids.has(mensagem.id)) {
      mensagens.push(mensagem)
      ids.add(mensagem.id)
    }
  }

  return mensagens
}

function Atendimento() {
  const navigate = useNavigate()

  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [conversa, setConversa] = useState<Conversa | null>(null)
  const [texto, setTexto] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  const erroSincronizacao = useSincronizarConversa({
    conversa,
    setConversa,
    enviando,
  })

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

        const usuarioCarregado: Usuario =
          await respostaUsuario.json()

        if (usuarioCarregado.papel === 'ANALISTA') {
          navigate('/analista', { replace: true })
          return
        }

        const respostaConversa = await fetch(
          `${API_URL}/conversas/atual`,
          {
            method: 'POST',
            headers,
            signal: controller.signal,
          },
        )

        if (respostaConversa.status === 401) {
          limparSessao()
          navigate('/', { replace: true })
          return
        }

        if (!respostaConversa.ok) {
          throw new Error('Não foi possível carregar a conversa.')
        }

        const conversaCarregada: Conversa =
          await respostaConversa.json()

        setUsuario(usuarioCarregado)
        setConversa(conversaCarregada)
      } catch (erroCapturado) {
        if (controller.signal.aborted) return

        console.error(
          'Erro ao carregar atendimento:',
          erroCapturado,
        )

        setErro(
          'Não foi possível carregar o atendimento. Verifique o servidor.',
        )
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

    if (
      !textoLimpo ||
      !token ||
      !conversa ||
      enviando ||
      conversa.status === 'ENCERRADA'
    ) {
      return
    }

    const conversaId = conversa.id

    setErro('')
    setEnviando(true)

    try {
      const resposta = await fetch(
        `${API_URL}/conversas/${conversaId}/mensagens`,
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
        const dados: { mensagem?: string } =
          await resposta.json()

        throw new Error(
          dados.mensagem || 'Não foi possível enviar a mensagem.',
        )
      }

      const dados: {
        mensagem: Mensagem
        respostaAgente: Mensagem | null
        aviso: string | null
      } = await resposta.json()

      setConversa((anterior) => {
        if (!anterior || anterior.id !== conversaId) {
          return anterior
        }

        const novasMensagens = [dados.mensagem]

        if (dados.respostaAgente) {
          novasMensagens.push(dados.respostaAgente)
        }

        return {
          ...anterior,
          mensagens: adicionarMensagens(
            anterior.mensagens,
            novasMensagens,
          ),
        }
      })

      setTexto('')

      if (dados.aviso) {
        setErro(dados.aviso)
      }
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
        <p role="alert" className="text-sm text-red-600">
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
  const encerrada = conversa.status === 'ENCERRADA'
  const comAgente = conversa.status === 'COM_AGENTE'

  return (
    <div className="flex min-h-screen bg-white text-slate-800">
      <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 p-4">
        <div className="mb-10 flex items-center gap-2 text-sm font-bold">
          <span className="text-2xl font-black text-blue-600">
            N
          </span>
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
        <header className="flex min-h-16 flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-6 py-3">
          <p className="text-xs text-slate-500">
            Service desk de TI <span className="mx-2">›</span>
            <span className="font-medium text-slate-800">
              Atendimento
            </span>
          </p>

          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700">
            {STATUS_CONVERSA[conversa.status] ?? conversa.status}
          </span>
        </header>

        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6">
          <div
            aria-live="polite"
            className="flex flex-1 flex-col gap-5 py-8"
          >
            {conversa.mensagens.length === 0 && (
              <p className="text-sm text-slate-500">
                Descreva como podemos ajudar com seu problema de TI.
              </p>
            )}

            {conversa.mensagens.map((mensagem) => {
              const enviadaPeloFuncionario =
                mensagem.autor === 'FUNCIONARIO'

              const acoes = mensagem.acoes ?? []

              if (mensagem.autor === 'SISTEMA') {
                return (
                  <p
                    key={mensagem.id}
                    className="text-center text-xs leading-5 text-slate-500"
                  >
                    {mensagem.texto}
                  </p>
                )
              }

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

                  {mensagem.autor === 'ASSISTENTE' &&
                    mensagem.entendimento &&
                    mensagem.justificativa &&
                    mensagem.seguranca && (
                      <details className="mb-2 rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-2">
                        <summary className="cursor-pointer text-xs font-medium text-blue-700">
                          Ver detalhes da decisão
                        </summary>

                        <div className="mt-3 space-y-3 text-xs leading-5 text-slate-600">
                          <div>
                            <p className="font-semibold text-slate-700">
                              O que entendeu
                            </p>
                            <p>{mensagem.entendimento}</p>
                          </div>

                          <div>
                            <p className="font-semibold text-slate-700">
                              Justificativa
                            </p>
                            <p>{mensagem.justificativa}</p>
                          </div>

                          <div>
                            <p className="font-semibold text-slate-700">
                              Segurança declarada pelo agente
                            </p>

                            <p>
                              {mensagem.seguranca === 'ALTA'
                                ? 'Alta'
                                : mensagem.seguranca === 'MEDIA'
                                  ? 'Média'
                                  : 'Baixa'}
                            </p>

                            <p className="mt-1 text-slate-500">
                              Autoavaliação do modelo, não uma garantia
                              de acerto.
                            </p>
                          </div>
                        </div>
                      </details>
                    )}

                  {mensagem.autor === 'ASSISTENTE' &&
                    acoes.length > 0 && (
                      <details className="mb-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <summary className="cursor-pointer text-xs text-slate-600">
                          {acoes
                            .map((acao) => acao.nome)
                            .join(' · ')}
                        </summary>

                        <div className="mt-3 space-y-3">
                          {acoes.map((acao) => (
                            <div
                              key={acao.id}
                              className="border-t border-slate-200 pt-3 text-xs leading-5"
                            >
                              <p className="font-semibold text-slate-700">
                                {acao.nome}
                              </p>

                              <p className="mt-1 text-slate-600">
                                <span className="font-medium">
                                  Entrada:{' '}
                                </span>
                                {acao.entrada}
                              </p>

                              <p className="mt-1 text-slate-600">
                                <span className="font-medium">
                                  Resultado:{' '}
                                </span>
                                {acao.resultado}
                              </p>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}

                  <div
                    className={
                      enviadaPeloFuncionario
                        ? 'whitespace-pre-wrap break-words rounded-xl bg-slate-800 px-4 py-3 text-sm text-white'
                        : mensagem.autor === 'ANALISTA'
                          ? 'whitespace-pre-wrap break-words rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-slate-800'
                          : 'whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm'
                    }
                  >
                    {mensagem.texto}
                  </div>
                </div>
              )
            })}
          </div>

          {enviando && (
            <p
              role="status"
              className="mb-3 text-sm text-slate-500"
            >
              {comAgente
                ? 'Nexo está processando sua mensagem...'
                : 'Enviando mensagem...'}
            </p>
          )}

          {comAgente && (
            <CartaoRascunho
              key={conversa.id}
              conversaId={conversa.id}
              token={obterToken()}
              atualizacao={conversa.mensagens.length}
              onMensagemSalva={(mensagem) => {
                setConversa((anterior) => {
                  if (!anterior) return anterior

                  return {
                    ...anterior,
                    mensagens: adicionarMensagens(
                      anterior.mensagens,
                      [mensagem],
                    ),
                  }
                })
              }}
            />
          )}

          {erro && (
            <p
              role="alert"
              className="mb-2 text-sm text-red-600"
            >
              {erro}
            </p>
          )}

          {erroSincronizacao && (
            <p
              role="status"
              className="mb-2 text-xs text-amber-700"
            >
              {erroSincronizacao}
            </p>
          )}

          {limiteAtingido && !encerrada && (
            <p className="mb-2 text-sm text-amber-700">
              Você atingiu o limite de mensagens desta conversa.
            </p>
          )}

          {encerrada ? (
            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p
                role="status"
                className="text-sm font-medium text-slate-700"
              >
                Este atendimento foi encerrado.
              </p>

              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-3 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
              >
                Iniciar novo atendimento
              </button>
            </div>
          ) : (
            <AtendimentoHumano
              conversaId={conversa.id}
              status={conversa.status}
              token={obterToken()}
              enviandoMensagem={enviando}
              onTransferir={(status, mensagem) => {
                setConversa((anterior) => {
                  if (!anterior) return anterior

                  return {
                    ...anterior,
                    status,
                    mensagens: mensagem
                      ? adicionarMensagens(
                          anterior.mensagens,
                          [mensagem],
                        )
                      : anterior.mensagens,
                  }
                })
              }}
            />
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
              placeholder={
                encerrada
                  ? 'Atendimento encerrado'
                  : comAgente
                    ? 'Escreva para o Nexo...'
                    : 'Escreva para o analista...'
              }
              maxLength={2000}
              disabled={enviando || limiteAtingido || encerrada}
              className="min-w-0 flex-1 px-3 py-2 text-sm outline-none disabled:opacity-60"
            />

            <button
              type="submit"
              disabled={
                enviando ||
                limiteAtingido ||
                !texto.trim() ||
                encerrada
              }
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {enviando ? 'Aguarde...' : 'Enviar'}
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