import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import cors from 'cors'
import express from 'express'
import jwt from 'jsonwebtoken'

import {
  autenticar,
  exigirAnalista,
  type UsuarioAutenticado,
} from './auth'

import { criarRotasAnalista } from './routes/analista'
import { buscarArtigos } from './services/artigos'
import { listarChamadosDoUsuario } from './services/chamados'

import {
  adicionarMensagem,
  obterOuCriarConversa,
} from './services/conversas'

import {
  confirmarRascunho,
  confirmacaoSchema,
} from './services/confirmacao'

import {
  cancelarRascunho,
  editarRascunho,
  edicaoRascunhoSchema,
} from './services/rascunhos'

import { responderConversa } from './services/respostas'
import { transferirParaAnalista } from './services/transferencias'

const app = express()
const prisma = new PrismaClient()
const PORT = Number(process.env.PORT || 3000)

const conversasEmRetentativa = new Set<string>()
const jwtSecret = process.env.JWT_SECRET

if (!jwtSecret) {
  throw new Error('A variável JWT_SECRET não foi configurada.')
}

app.use(cors())
app.use(express.json())

app.use(
  '/analista',
  autenticar,
  exigirAnalista(prisma),
  criarRotasAnalista(prisma),
)

app.get('/health', (_request, response) => {
  response.json({
    status: 'ok',
    service: 'Nexo Assist API',
  })
})

app.post('/auth/login', async (request, response) => {
  const { email, senha } = (request.body ?? {}) as {
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
      where: {
        email: email.trim().toLowerCase(),
      },
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
        papel: usuario.papel,
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
      select: {
        id: true,
        nome: true,
        email: true,
        papel: true,
      },
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

app.post(
  '/conversas/:id/mensagens',
  autenticar,
  async (request, response) => {
    const { id: usuarioId } =
      response.locals.usuario as UsuarioAutenticado

    const conversaId = request.params.id

    const { texto } = (request.body ?? {}) as {
      texto?: unknown
    }

    if (typeof conversaId !== 'string' || !conversaId.trim()) {
      return response.status(400).json({
        mensagem: 'Identificador da conversa inválido.',
      })
    }

    if (typeof texto !== 'string' || !texto.trim()) {
      return response.status(400).json({
        mensagem: 'Digite uma mensagem.',
      })
    }

    const textoLimpo = texto.trim()

    if (textoLimpo.length > 2000) {
      return response.status(400).json({
        mensagem: 'A mensagem deve ter no máximo 2.000 caracteres.',
      })
    }

    try {
      const resultado = await adicionarMensagem(
        prisma,
        usuarioId,
        conversaId,
        textoLimpo,
      )

      if ('erro' in resultado) {
        if (resultado.erro === 'CONVERSA_NAO_ENCONTRADA') {
          return response.status(404).json({
            mensagem: 'Conversa não encontrada.',
          })
        }

        return response.status(400).json({
          mensagem:
            'Você atingiu o limite de 30 mensagens nesta conversa.',
        })
      }

      if (request.accepts('application/x-ndjson') &&
          request.get('Accept')?.includes('application/x-ndjson')) {
        response.status(201)
        response.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8')
        response.setHeader('Cache-Control', 'no-cache, no-transform')
        response.flushHeaders()
        const emitir = (evento: object) => {
          if (!response.destroyed) response.write(JSON.stringify(evento) + '\n')
        }
        emitir({ tipo: 'mensagem', mensagem: resultado.mensagem })
        try {
          const respostaAgente = await responderConversa(
            prisma, usuarioId, conversaId,
            (acao) => emitir({ tipo: 'progresso', texto: acao.nome }),
          )
          emitir({ tipo: 'concluido', respostaAgente })
        } catch (erro) {
          console.error('Falha ao gerar resposta do agente:', erro)
          emitir({ tipo: 'falha', aviso: 'Sua mensagem foi salva, mas o assistente não conseguiu responder agora. Tente responder novamente.' })
        } finally {
          response.end()
        }
        return
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
        console.error(
          'Falha ao gerar resposta do agente:',
          erroAgente,
        )

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
  },
)

app.post(
  '/conversas/:id/responder',
  autenticar,
  async (request, response) => {
    const { id: usuarioId } =
      response.locals.usuario as UsuarioAutenticado

    const conversaId = request.params.id

    if (typeof conversaId !== 'string' || !conversaId.trim()) {
      return response.status(400).json({
        mensagem: 'Identificador da conversa inválido.',
      })
    }

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
          mensagem:
            'Conversa disponível para o agente não encontrada.',
        })
      }

      const ultimaMensagem = conversa.mensagens[0]

      if (
        !ultimaMensagem ||
        ultimaMensagem.autor !== 'FUNCIONARIO'
      ) {
        return response.status(409).json({
          mensagem:
            'Não há uma mensagem do funcionário aguardando resposta.',
        })
      }

      if (conversasEmRetentativa.has(conversaId)) {
        return response.status(409).json({
          mensagem:
            'Já existe uma tentativa de resposta em andamento.',
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
            mensagem:
              'A conversa não está mais disponível para o agente.',
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
  },
)

app.get(
  '/conversas/:id/rascunho',
  autenticar,
  async (request, response) => {
    const { id: usuarioId } =
      response.locals.usuario as UsuarioAutenticado

    const conversaId = request.params.id

    if (typeof conversaId !== 'string' || !conversaId.trim()) {
      return response.status(400).json({
        mensagem: 'Identificador da conversa inválido.',
      })
    }

    try {
      const conversa = await prisma.conversa.findFirst({
        where: {
          id: conversaId,
          usuarioId,
        },
        select: {
          rascunho: {
            select: {
              id: true,
              titulo: true,
              descricao: true,
              tipo: true,
              categoria: true,
              prioridade: true,
              afetados: true,
              atualizadoEm: true,
            },
          },
        },
      })

      if (!conversa) {
        return response.status(404).json({
          mensagem: 'Conversa não encontrada.',
        })
      }

      return response.json({
        rascunho: conversa.rascunho,
      })
    } catch (erro) {
      console.error('Erro ao consultar rascunho:', erro)

      return response.status(500).json({
        mensagem: 'Não foi possível carregar o rascunho.',
      })
    }
  },
)

app.post(
  '/conversas/:id/rascunho/:rascunhoId/confirmar',
  autenticar,
  async (request, response) => {
    const { id: usuarioId } =
      response.locals.usuario as UsuarioAutenticado

    const conversaId = request.params.id
    const rascunhoId = request.params.rascunhoId

    if (
      typeof conversaId !== 'string' ||
      !conversaId.trim() ||
      typeof rascunhoId !== 'string' ||
      !rascunhoId.trim()
    ) {
      return response.status(400).json({
        mensagem: 'Identificadores inválidos.',
      })
    }

    const validacao = confirmacaoSchema.safeParse(request.body)

    if (!validacao.success) {
      return response.status(400).json({
        mensagem:
          'Os dados da confirmação estão incompletos ou inválidos.',
      })
    }

    try {
      const resultado = await confirmarRascunho(
        prisma,
        usuarioId,
        conversaId,
        rascunhoId,
        validacao.data,
      )

      switch (resultado.status) {
        case 'CRIADO':
          return response.status(201).json(resultado)

        case 'ATUALIZADO':
        case 'REABERTO':
        case 'JA_CONFIRMADO':
          return response.json(resultado)

        case 'REVISAO_NECESSARIA':
          return response.status(409).json({
            ...resultado,
            mensagem:
              'Revise os chamados encontrados antes de confirmar.',
          })

        case 'RASCUNHO_ALTERADO':
          return response.status(409).json({
            mensagem:
              'O rascunho mudou. Recarregue a página e confira os dados.',
          })

        case 'CHAMADO_ALTERADO':
          return response.status(409).json({
            mensagem:
              'O chamado mudou ou não pode mais ser usado. Revise novamente.',
          })

        case 'CONVERSA_INDISPONIVEL':
          return response.status(409).json({
            mensagem:
              'A conversa não está disponível para confirmação.',
          })

        default:
          return response.status(404).json({
            mensagem: 'Conversa ou rascunho não encontrado.',
          })
      }
    } catch (erro) {
      console.error('Erro ao confirmar rascunho:', erro)

      return response.status(500).json({
        mensagem:
          'Não foi possível concluir a confirmação. Consulte o estado antes de tentar novamente.',
      })
    }
  },
)

app.delete(
  '/conversas/:id/rascunho/:rascunhoId',
  autenticar,
  async (request, response) => {
    const { id: usuarioId } =
      response.locals.usuario as UsuarioAutenticado

    const conversaId = request.params.id
    const rascunhoId = request.params.rascunhoId

    if (
      typeof conversaId !== 'string' ||
      !conversaId.trim() ||
      typeof rascunhoId !== 'string' ||
      !rascunhoId.trim()
    ) {
      return response.status(400).json({
        mensagem: 'Identificadores inválidos.',
      })
    }

    try {
      const resultado = await cancelarRascunho(
        prisma,
        usuarioId,
        conversaId,
        rascunhoId,
      )

      if (resultado.status === 'CANCELADO') {
        return response.json(resultado)
      }

      if (resultado.status === 'CONVERSA_INDISPONIVEL') {
        return response.status(409).json({
          mensagem:
            'A conversa não está disponível para cancelar o rascunho.',
        })
      }

      return response.status(404).json({
        mensagem: 'Conversa ou rascunho não encontrado.',
      })
    } catch (erro) {
      console.error('Erro ao cancelar rascunho:', erro)

      return response.status(500).json({
        mensagem: 'Não foi possível cancelar o rascunho.',
      })
    }
  },
)

app.patch(
  '/conversas/:id/rascunho/:rascunhoId',
  autenticar,
  async (request, response) => {
    const { id: usuarioId } =
      response.locals.usuario as UsuarioAutenticado

    const conversaId = request.params.id
    const rascunhoId = request.params.rascunhoId

    if (
      typeof conversaId !== 'string' ||
      !conversaId.trim() ||
      typeof rascunhoId !== 'string' ||
      !rascunhoId.trim()
    ) {
      return response.status(400).json({
        mensagem: 'Identificadores inválidos.',
      })
    }

    const validacao = edicaoRascunhoSchema.safeParse(request.body)

    if (!validacao.success) {
      return response.status(400).json({
        mensagem:
          'Informe um título de 5 a 150 caracteres e uma descrição de 10 a 2.000 caracteres.',
      })
    }

    try {
      const resultado = await editarRascunho(
        prisma,
        usuarioId,
        conversaId,
        rascunhoId,
        validacao.data,
      )

      if (resultado.status === 'EDITADO') {
        return response.json(resultado)
      }

      if (resultado.status === 'CONVERSA_INDISPONIVEL') {
        return response.status(409).json({
          mensagem:
            'A conversa não está disponível para editar o rascunho.',
        })
      }

      return response.status(404).json({
        mensagem: 'Conversa ou rascunho não encontrado.',
      })
    } catch (erro) {
      console.error('Erro ao editar rascunho:', erro)

      return response.status(500).json({
        mensagem: 'Não foi possível editar o rascunho.',
      })
    }
  },
)

app.post(
  '/conversas/:id/transferir',
  autenticar,
  async (request, response) => {
    const { id: usuarioId } =
      response.locals.usuario as UsuarioAutenticado

    const conversaId = request.params.id

    if (typeof conversaId !== 'string' || !conversaId.trim()) {
      return response.status(400).json({
        mensagem: 'Identificador da conversa inválido.',
      })
    }

    try {
      const resultado = await transferirParaAnalista(
        prisma,
        usuarioId,
        conversaId,
      )

      switch (resultado.status) {
        case 'ENCAMINHADA':
        case 'JA_ENCAMINHADA':
          return response.json(resultado)

        case 'CONVERSA_NAO_ENCONTRADA':
          return response.status(404).json({
            mensagem: 'Conversa não encontrada.',
          })

        case 'CONVERSA_ENCERRADA':
          return response.status(409).json({
            mensagem: 'Esta conversa já foi encerrada.',
          })

        default:
          return response.status(409).json({
            mensagem:
              'O estado da conversa mudou. Recarregue a página.',
          })
      }
    } catch (erro) {
      console.error('Erro ao transferir conversa:', erro)

      return response.status(500).json({
        mensagem: 'Não foi possível encaminhar a conversa.',
      })
    }
  },
)

app.get('/conversas/:id', autenticar, async (request, response) => {
  const { id: usuarioId } = response.locals.usuario as UsuarioAutenticado
  const conversaId = request.params.id

  if (typeof conversaId !== 'string' || !conversaId.trim()) {
    return response.status(400).json({
      mensagem: 'Identificador da conversa inválido.',
    })
  }

  try {
    const conversa = await prisma.conversa.findFirst({
      where: {
        id: conversaId,
        usuarioId,
      },
      include: {
        mensagens: {
          orderBy: { criadoEm: 'asc' },
          include: {
            acoes: {
              orderBy: { criadoEm: 'asc' },
            },
          },
        },
      },
    })

    if (!conversa) {
      return response.status(404).json({
        mensagem: 'Conversa não encontrada.',
      })
    }

    return response.json(conversa)
  } catch (erro) {
    console.error('Erro ao atualizar conversa:', erro)

    return response.status(500).json({
      mensagem: 'Não foi possível atualizar a conversa.',
    })
  }
})

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`)
})