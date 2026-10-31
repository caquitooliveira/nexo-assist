import type { PrismaClient } from '@prisma/client'
import { decisaoSchema } from '../agente/decisao'
import {
  criarNexoAgent,
  type RegistroAcao,
} from '../agente/nexoAgent'
import { avaliarEncaminhamento } from './encaminhamento'
import { transferirParaAnalista } from './transferencias'

async function gerarResposta(
  prisma: PrismaClient,
  usuarioId: string,
  conversaId: string,
  informarProgresso?: (acao: RegistroAcao) => void,
) {
  const conversa = await prisma.conversa.findFirst({
    where: {
      id: conversaId,
      usuarioId,
      status: 'COM_AGENTE',
    },
    include: {
      mensagens: {
        orderBy: { criadoEm: 'asc' },
      },
    },
  })

  if (!conversa) {
    return null
  }

  const historico = conversa.mensagens.map((mensagem) => {
    if (mensagem.autor === 'FUNCIONARIO') {
      return {
        role: 'user' as const,
        content: mensagem.texto,
      }
    }

    return {
      role: 'assistant' as const,
      content: mensagem.texto,
    }
  })

  const acoes: RegistroAcao[] = []

  const agente = criarNexoAgent(
    prisma,
    usuarioId,
    (acao) => {
      acoes.push(acao)
      informarProgresso?.(acao)
    },
    conversaId,
  )

  const sinal = AbortSignal.timeout(60_000)

  const resultado = await agente.generate(historico, {
    maxSteps: 5,
    abortSignal: sinal,
    modelSettings: {
      maxRetries: 0,
      maxOutputTokens: 1536,
    },
    structuredOutput: {
      schema: decisaoSchema,
      jsonPromptInjection: true,
      errorStrategy: 'strict',
    },
  })

  sinal.throwIfAborted()

  if (
    resultado.finishReason === 'aborted' ||
    resultado.finishReason === 'length'
  ) {
    throw new Error('O agente não concluiu uma resposta completa.')
  }

  const decisao = decisaoSchema.parse(resultado.object)

  if (!decisao.texto.trim()) {
    throw new Error('O agente não retornou uma resposta completa.')
  }

  const encaminhamento = await avaliarEncaminhamento(
    prisma,
    usuarioId,
    decisao,
  )

  if (encaminhamento) {
    const transferencia = await transferirParaAnalista(
      prisma,
      usuarioId,
      conversaId,
      {
        encaminhamento,
        decisao,
        acoes,
      },
    )

    if (transferencia.status === 'ENCAMINHADA') {
      return transferencia.mensagem
    }

    // A conversa pode ter sido assumida, transferida ou encerrada
    // enquanto o modelo estava processando.
    return null
  }

  return prisma.$transaction(async (transacao) => {
    const conversaAtual = await transacao.conversa.findFirst({
      where: {
        id: conversaId,
        usuarioId,
        status: 'COM_AGENTE',
      },
    })

    if (!conversaAtual) {
      return null
    }

    const ultimaMensagem = await transacao.mensagem.findFirst({
      where: { conversaId }, orderBy: { criadoEm: 'desc' },
    })
    // Não publique uma resposta baseada num histórico ultrapassado.
    if (ultimaMensagem?.id !== conversa.mensagens.at(-1)?.id) return null

    const mensagem = await transacao.mensagem.create({
      data: {
        conversaId,
        autor: 'ASSISTENTE',
        texto: decisao.texto.trim(),
        entendimento: decisao.entendimento,
        justificativa: decisao.justificativa,
        seguranca: decisao.seguranca,
        acoes: {
          create: acoes,
        },
      },
      include: {
        acoes: {
          orderBy: { criadoEm: 'asc' },
        },
      },
    })

    await transacao.conversa.update({
      where: { id: conversaId },
      data: { atualizadoEm: new Date() },
    })

    return mensagem
  })
}
const respostasEmAndamento = new Set<string>()
export async function responderConversa(
  prisma: PrismaClient,
  usuarioId: string,
  conversaId: string,
  informarProgresso?: (acao: RegistroAcao) => void,
) {
  if (respostasEmAndamento.has(conversaId)) return null
  respostasEmAndamento.add(conversaId)
  try {
    return await gerarResposta(prisma, usuarioId, conversaId, informarProgresso)
  } finally {
    respostasEmAndamento.delete(conversaId)
  }
}
