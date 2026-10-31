import {
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react'
import { useNavigate } from 'react-router-dom'

type ConversaBase = {
  id: string
  status: string
  atualizadoEm: string
  mensagens: { id: string }[]
}

type Opcoes<T extends ConversaBase> = {
  conversa: T | null
  setConversa: Dispatch<SetStateAction<T | null>>
  enviando: boolean
}

export function useSincronizarConversa<T extends ConversaBase>({
  conversa,
  setConversa,
  enviando,
}: Opcoes<T>) {
  const navigate = useNavigate()
  const [erroSincronizacao, setErroSincronizacao] = useState('')
  const conversaId = conversa?.id

  useEffect(() => {
    if (!conversaId || enviando) return

    const controller = new AbortController()
    let proximaAtualizacao: ReturnType<typeof setTimeout> | undefined

    async function atualizar() {
      const token =
        localStorage.getItem('nexo-token') ||
        sessionStorage.getItem('nexo-token')

      if (!token) {
        navigate('/', { replace: true })
        return
      }

      try {
        const resposta = await fetch(
          `http://localhost:3000/conversas/${conversaId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            signal: controller.signal,
          },
        )

        if (resposta.status === 401) {
          localStorage.removeItem('nexo-token')
          localStorage.removeItem('nexo-usuario')
          sessionStorage.removeItem('nexo-token')
          sessionStorage.removeItem('nexo-usuario')

          navigate('/', { replace: true })
          return
        }

        if (!resposta.ok) {
          throw new Error('Não foi possível atualizar a conversa.')
        }

        const dados: T = await resposta.json()

        if (controller.signal.aborted) return

        setConversa((anterior) => {
          if (!anterior || anterior.id !== dados.id) {
            return anterior
          }

          const respostaMaisAntiga =
            new Date(dados.atualizadoEm).getTime() <
            new Date(anterior.atualizadoEm).getTime()

          const faltamMensagens =
            dados.mensagens.length < anterior.mensagens.length

          if (respostaMaisAntiga || faltamMensagens) {
            return anterior
          }

          return dados
        })

        setErroSincronizacao('')
      } catch (erro) {
        if (controller.signal.aborted) return

        console.error('Erro ao sincronizar conversa:', erro)

        setErroSincronizacao(
          'A atualização automática falhou. Tentaremos novamente.',
        )
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
  }, [conversaId, enviando, navigate, setConversa])

  return erroSincronizacao
}