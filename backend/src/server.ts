import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import cors from 'cors'
import express from 'express'
import jwt from 'jsonwebtoken'
import { autenticar, type UsuarioAutenticado } from './auth'
import { listarChamadosDoUsuario } from './services/chamados'

const app = express()
const prisma = new PrismaClient()
const PORT = 3000

const jwtSecret = process.env.JWT_SECRET

if (!jwtSecret) {
  throw new Error('A variável JWT_SECRET não foi configurada.')
}

app.use(cors())
app.use(express.json())

app.get('/health', (_request, response) => {
  response.json({ status: 'ok', service: 'Nexo Assist API' })
})

app.post('/auth/login', async (request, response) => {
  const { email, senha } = request.body as {
    email?: unknown
    senha?: unknown
  }

  if (
    typeof email !== 'string' ||
    typeof senha !== 'string' ||
    !email.trim() ||
    !senha.trim()
  ) {
    return response.status(400).json({
      mensagem: 'Informe o e-mail e a senha.',
    })
  }

  try {
    const usuario = await prisma.usuario.findUnique({
      where: { email: email.trim().toLowerCase() },
    })

    if (!usuario) {
      return response.status(401).json({
        mensagem: 'Funcionário não encontrado.',
      })
    }

    const token = jwt.sign(
      { nome: usuario.nome },
      jwtSecret,
      {
        subject: usuario.id,
        expiresIn: '8h',
      },
    )

    return response.json({
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
      },
    })
  } catch (erro) {
    console.error('Erro ao realizar login:', erro)

    return response.status(500).json({
      mensagem: 'Não foi possível realizar o login. Tente novamente.',
    })
  }
})

app.get('/auth/me', autenticar, async (_request, response) => {
  const { id } = response.locals.usuario as UsuarioAutenticado

  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id },
      select: { id: true, nome: true, email: true },
    })

    if (!usuario) {
      return response.status(401).json({
        mensagem: 'Usuário não encontrado. Faça login novamente.',
      })
    }

    return response.json(usuario)
  } catch (erro) {
    console.error('Erro ao consultar usuário:', erro)

    return response.status(500).json({
      mensagem: 'Não foi possível consultar a sessão.',
    })
  }
})

app.get('/chamados', autenticar, async (_request, response) => {
  const { id } = response.locals.usuario as UsuarioAutenticado

  try {
    const chamados = await listarChamadosDoUsuario(prisma, id)

    return response.json(chamados)
  } catch (erro) {
    console.error('Erro ao consultar chamados:', erro)

    return response.status(500).json({
      mensagem: 'Não foi possível consultar os chamados.',
    })
  }
})

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`)
})