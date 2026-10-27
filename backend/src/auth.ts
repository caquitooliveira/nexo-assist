import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'

export type UsuarioAutenticado = {
  id: string
}

export function autenticar(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  const autorizacao = request.headers.authorization

  if (!autorizacao?.startsWith('Bearer ')) {
    return response.status(401).json({
      mensagem: 'Faça login para continuar.',
    })
  }

  const token = autorizacao.slice(7)
  const jwtSecret = process.env.JWT_SECRET

  if (!jwtSecret) {
    return response.status(500).json({
      mensagem: 'Configuração de autenticação indisponível.',
    })
  }

  try {
    const payload = jwt.verify(token, jwtSecret)

    if (typeof payload === 'string' || !payload.sub) {
      return response.status(401).json({
        mensagem: 'Sessão inválida.',
      })
    }

    response.locals.usuario = { id: payload.sub } satisfies UsuarioAutenticado
    next()
  } catch {
    return response.status(401).json({
      mensagem: 'Sessão inválida ou expirada. Faça login novamente.',
    })
  }
}