import TextoMensagem from '../components/TextoMensagem'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import CartaoRascunho from '../components/CartaoRascunho'
import PainelChamados from '../components/PainelChamados'
import AtendimentoHumano from '../components/AtendimentoHumano'
import { useSincronizarConversa } from '../hooks/useSincronizarConversa'
import BarraFuncionario from '../components/BarraFuncionario'

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
  const [progresso, setProgresso] = useState('')

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
    setProgresso('Nexo está analisando sua mensagem...')

    try {
      const resposta = await fetch(
        `${API_URL}/conversas/${conversaId}/mensagens`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/x-ndjson',
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
        const dados = await resposta.json() as { mensagem?: string }
        throw new Error(dados.mensagem || 'Não foi possível enviar a mensagem.')
      }
      if (!resposta.body) throw new Error('O servidor não retornou a resposta.')
      const leitor = resposta.body.getReader()
      const decoder = new TextDecoder()
      let pendente = ''
      let concluido = false
      const receber = (linha: string) => {
        if (!linha.trim()) return
        const evento = JSON.parse(linha) as {
          tipo: string; mensagem?: Mensagem; respostaAgente?: Mensagem | null
          texto?: string; aviso?: string
        }
        if (evento.tipo === 'progresso') setProgresso(evento.texto ?? '')
        if (evento.tipo === 'mensagem') setTexto('')
        if (evento.tipo === 'falha') { setErro(evento.aviso ?? 'Falha ao responder.'); concluido = true }
        if (evento.tipo === 'concluido') concluido = true
        const mensagem = evento.mensagem ?? evento.respostaAgente
        if (mensagem) setConversa((anterior) => {
          if (!anterior || anterior.id !== conversaId) return anterior
          return { ...anterior, mensagens: adicionarMensagens(anterior.mensagens, [mensagem]) }
        })
      }
      while (true) {
        const { value, done } = await leitor.read()
        pendente += decoder.decode(value, { stream: !done })
        const linhas = pendente.split('\n')
        pendente = linhas.pop() ?? ''
        linhas.forEach(receber)
        if (done) break
      }
      receber(pendente)
      if (!concluido) throw new Error('Conexão interrompida. Recarregue para conferir as mensagens salvas antes de reenviar.')

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

  async function tentarResposta() {
    if (!conversa || enviando) return
    setEnviando(true)
    setErro('')
    try {
      const resposta = await fetch(`${API_URL}/conversas/${conversa.id}/responder`, {
        method: 'POST', headers: { Authorization: `Bearer ${obterToken()}` },
      })
      const dados = await resposta.json()
      if (!resposta.ok) throw new Error(dados.mensagem || 'Não foi possível responder agora.')
      setConversa((atual) => atual ? { ...atual, mensagens: adicionarMensagens(atual.mensagens, [dados as Mensagem]) } : atual)
    } catch (erro) {
      setErro(erro instanceof Error ? erro.message : 'Não foi possível responder agora.')
    } finally { setEnviando(false) }
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
      <BarraFuncionario usuario={usuario} onSair={sair} />
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
                    <TextoMensagem texto={mensagem.texto} />
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
                    <TextoMensagem texto={mensagem.texto} />
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
                ? progresso || 'Nexo está processando sua mensagem...'
                : 'Enviando mensagem...'}
            </p>
          )}

          {comAgente && conversa.mensagens.at(-1)?.autor === 'FUNCIONARIO' && !enviando && (
            <button type="button" onClick={() => void tentarResposta()} className="mb-4 rounded-lg border border-blue-200 px-3 py-2 text-sm text-blue-700">Tentar responder novamente</button>
          )}
          <PainelChamados token={obterToken()} atualizacao={conversa.mensagens.length} desabilitado={enviando || encerrada || limiteAtingido} onSelecionar={setTexto} />
          {comAgente && !enviando && !encerrada && !limiteAtingido && (
            <div className="mb-4 flex flex-wrap gap-2">
              {['Uso Windows 10.', 'Uso Windows 11.', 'Somente eu sou afetado.', 'Toda a equipe está afetada.', 'Não consigo trabalhar e não tenho alternativa.', 'Tenho uma alternativa para continuar.', 'É um pedido sem urgência.'].map((opcao) => (
                <button key={opcao} type="button" onClick={() => setTexto(opcao)} className="rounded-full border border-slate-200 px-3 py-1 text-xs hover:bg-blue-50">{opcao}</button>
              ))}
            </div>
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