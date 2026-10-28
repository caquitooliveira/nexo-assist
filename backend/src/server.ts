import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import cors from 'cors'
import express from 'express'
import jwt from 'jsonwebtoken'
import { autenticar, type UsuarioAutenticado } from './auth'
import { listarChamadosDoUsuario } from './services/chamados'
import {
  adicionarMensagem,
  obterOuCriarConversa,
} from './services/conversas'
import { buscarArtigos } from './services/artigos'
import { responderConversa } from './services/respostas'

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

app.post('/conversas/:id/mensagens', autenticar, async (request, response) => {
  const { id: usuarioId } = response.locals.usuario as UsuarioAutenticado
  const { texto } = request.body as { texto?: unknown }
  const conversaId = request.params.id

  if (typeof texto !== 'string' || !texto.trim()) {
    return response.status(400).json({
      mensagem: 'Digite uma mensagem.',
    })
  }

  if (texto.trim().length > 2000) {
    return response.status(400).json({
      mensagem: 'A mensagem deve ter no máximo 2.000 caracteres.',
    })
  }

  try {
    const resultado = await adicionarMensagem(
      prisma,
      usuarioId,
      conversaId,
      texto.trim(),
    )

    if ('erro' in resultado) {
      if (resultado.erro === 'CONVERSA_NAO_ENCONTRADA') {
        return response.status(404).json({
          mensagem: 'Conversa não encontrada.',
        })
      }

      return response.status(400).json({
        mensagem: 'Você atingiu o limite de 30 mensagens nesta conversa.',
      })
    }

    try {
      const respostaAgente = await responderConversa(
        prisma,
        usuarioId,
        conversaId,
      )

      return response.status(201).json({
        mensagem: resultado.mensagem,
        respostaAgente,
        aviso: null,
      })
    } catch (erroAgente) {
      console.error('Falha ao gerar resposta do agente:', erroAgente)

      return response.status(201).json({
        mensagem: resultado.mensagem,
        respostaAgente: null,
        aviso:
          'Sua mensagem foi salva, mas o assistente não conseguiu responder agora.',
      })
    }
  } catch (erro) {
    console.error('Erro ao salvar mensagem:', erro)

    return response.status(500).json({
      mensagem: 'Não foi possível salvar a mensagem.',
    })
  }
})

app.post('/conversas/:id/mensagens', autenticar, async (request, response) => {
  const { id: usuarioId } = response.locals.usuario as UsuarioAutenticado
  const { texto } = request.body as { texto?: unknown }
  const conversaId = request.params.id

  if (typeof texto !== 'string' || !texto.trim()) {
    return response.status(400).json({
      mensagem: 'Digite uma mensagem.',
    })
  }

  if (texto.trim().length > 2000) {
    return response.status(400).json({
      mensagem: 'A mensagem deve ter no máximo 2.000 caracteres.',
    })
  }

  try {
    const resultado = await adicionarMensagem(
      prisma,
      usuarioId,
      conversaId,
      texto.trim(),
    )

    if ('erro' in resultado) {
      if (resultado.erro === 'CONVERSA_NAO_ENCONTRADA') {
        return response.status(404).json({
          mensagem: 'Conversa não encontrada.',
        })
      }

      return response.status(400).json({
        mensagem: 'Você atingiu o limite de 30 mensagens nesta conversa.',
      })
    }

    return response.status(201).json(resultado.mensagem)
  } catch (erro) {
    console.error('Erro ao enviar mensagem:', erro)

    return response.status(500).json({
      mensagem: 'Não foi possível enviar a mensagem.',
    })
  }
})

app.get('/artigos', autenticar, async (request, response) => {
  const busca = request.query.busca

  if (typeof busca !== 'string' || !busca.trim()) {
    return response.status(400).json({
      mensagem: 'Informe um termo para buscar na central de ajuda.',
    })
  }

  if (busca.length > 500) {
    return response.status(400).json({
      mensagem: 'A busca deve ter no máximo 500 caracteres.',
    })
  }

  try {
    const artigos = await buscarArtigos(prisma, busca)

    return response.json(artigos)
  } catch (erro) {
    console.error('Erro ao buscar artigos:', erro)

    return response.status(500).json({
      mensagem: 'Não foi possível consultar a central de ajuda.',
    })
  }
})

app.post('/conversas/atual', autenticar, async (_request, response) => {
  const { id } = response.locals.usuario as UsuarioAutenticado

  try {
    const conversa = await obterOuCriarConversa(prisma, id)

    return response.json(conversa)
  } catch (erro) {
    console.error('Erro ao carregar conversa:', erro)

    return response.status(500).json({
      mensagem: 'Não foi possível carregar a conversa.',
    })
  }
})

const conversasEmRetentativa = new Set<string>()

app.post('/conversas/:id/responder', autenticar, async (request, response) => {
  const { id: usuarioId } = response.locals.usuario as UsuarioAutenticado
  const conversaId = request.params.id

  try {
    const conversa = await prisma.conversa.findFirst({
      where: {
        id: conversaId,
        usuarioId,
        status: 'COM_AGENTE',
      },
      include: {
        mensagens: {
          orderBy: { criadoEm: 'desc' },
          take: 1,
        },
      },
    })

    if (!conversa) {
      return response.status(404).json({
        mensagem: 'Conversa disponível para o agente não encontrada.',
      })
    }

    const ultimaMensagem = conversa.mensagens[0]

    if (!ultimaMensagem || ultimaMensagem.autor !== 'FUNCIONARIO') {
      return response.status(409).json({
        mensagem: 'Não há uma mensagem do funcionário aguardando resposta.',
      })
    }

    if (conversasEmRetentativa.has(conversaId)) {
      return response.status(409).json({
        mensagem: 'Já existe uma tentativa de resposta em andamento.',
      })
    }

    conversasEmRetentativa.add(conversaId)

    try {
      const respostaAgente = await responderConversa(
        prisma,
        usuarioId,
        conversaId,
      )

      if (!respostaAgente) {
        return response.status(409).json({
          mensagem: 'A conversa não está mais disponível para o agente.',
        })
      }

      return response.json(respostaAgente)
    } finally {
      conversasEmRetentativa.delete(conversaId)
    }
  } catch (erro) {
    console.error('Erro ao tentar responder novamente:', erro)

    return response.status(503).json({
      mensagem:
        'Não foi possível gerar a resposta agora. As mensagens continuam salvas.',
    })
  }
})

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`)
})