import { Router } from 'express'
import type {
  ErrorRequestHandler,
  Request,
  RequestHandler,
  Response,
} from 'express'
import type { PrismaClient } from '@prisma/client'
import type { UsuarioAutenticado } from '../auth'
import {
  alterarEstadoAtendimento,
  ErroAtendimento,
  listarConversasAnalista,
  obterConversaAnalista,
  responderComoAnalista,
} from '../services/analista'

function obterConversaId(request: Request) {
  const id = request.params.id

  if (typeof id !== 'string' || !id.trim()) {
    throw new ErroAtendimento(400, 'Identificador inválido.')
  }

  return id
}

function executar(
  funcao: (request: Request, response: Response) => Promise<unknown>,
): RequestHandler {
  return async (request, response, next) => {
    try {
      await funcao(request, response)
    } catch (erro) {
      next(erro)
    }
  }
}

export function criarRotasAnalista(prisma: PrismaClient) {
  const router = Router()

  router.get(
    '/conversas',
    executar(async (_request, response) => {
      const conversas = await listarConversasAnalista(prisma)
      response.json(conversas)
    }),
  )

  router.get(
    '/conversas/:id',
    executar(async (request, response) => {
      const conversa = await obterConversaAnalista(
        prisma,
        obterConversaId(request),
      )

      response.json(conversa)
    }),
  )

  router.patch(
    '/conversas/:id/estado',
    executar(async (request, response) => {
      const { id: analistaId } =
        response.locals.usuario as UsuarioAutenticado

      const conversaId = obterConversaId(request)
      const { acao } = (request.body ?? {}) as { acao?: unknown }

      if (
        acao !== 'ASSUMIR' &&
        acao !== 'DEVOLVER' &&
        acao !== 'ENCERRAR'
      ) {
        throw new ErroAtendimento(400, 'Ação inválida.')
      }

      const resultado = await alterarEstadoAtendimento(
        prisma,
        analistaId,
        conversaId,
        acao,
      )

      response.json(resultado)
    }),
  )

  router.post(
    '/conversas/:id/mensagens',
    executar(async (request, response) => {
      const { id: analistaId } =
        response.locals.usuario as UsuarioAutenticado

      const conversaId = obterConversaId(request)
      const { texto } = (request.body ?? {}) as { texto?: unknown }

      if (
        typeof texto !== 'string' ||
        !texto.trim() ||
        texto.trim().length > 2000
      ) {
        throw new ErroAtendimento(
          400,
          'Informe uma mensagem de até 2.000 caracteres.',
        )
      }

      const mensagem = await responderComoAnalista(
        prisma,
        analistaId,
        conversaId,
        texto.trim(),
      )

      response.status(201).json(mensagem)
    }),
  )

  const tratarErro: ErrorRequestHandler = (
    erro,
    _request,
    response,
    _next,
  ) => {
    if (erro instanceof ErroAtendimento) {
      response.status(erro.statusCode).json({
        mensagem: erro.message,
      })
      return
    }

    console.error('Erro no console do analista:', erro)

    response.status(500).json({
      mensagem: 'Não foi possível concluir a operação.',
    })
  }

  router.use(tratarErro)

  return router
}