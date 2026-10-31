import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'

export const rascunhoSchema = z.object({
  titulo: z.string().trim().min(5).max(150),
  descricao: z.string().trim().min(10).max(2000),

  tipo: z.enum(['INC', 'REQ']),

  categoria: z.enum([
    'Acesso',
    'Rede e VPN',
    'Hardware',
    'Software',
    'E-mail',
    'Outros',
  ]),

  afetados: z.string().trim().min(3).max(300),

  impacto: z.enum([
    'UMA_PESSOA',
    'EQUIPE',
    'EMPRESA',
  ]),

  urgencia: z.enum([
    'PARADO',
    'COMPROMISSO_HOJE',
    'COM_ALTERNATIVA',
    'SEM_URGENCIA',
  ]),
})

type DadosRascunho = z.infer<typeof rascunhoSchema>

export function classificarPrioridade(
  impacto: DadosRascunho['impacto'],
  urgencia: DadosRascunho['urgencia'],
) {
  if (
    urgencia === 'PARADO' &&
    (impacto === 'EQUIPE' || impacto === 'EMPRESA')
  ) {
    return {
      prioridade: 'Critica',
      justificativa: 'O problema impede o trabalho de uma equipe ou da empresa.',
    }
  }

  if (urgencia === 'PARADO' || urgencia === 'COMPROMISSO_HOJE') {
    return {
      prioridade: 'Alta',
      justificativa:
        'O problema impede uma pessoa de trabalhar ou coloca um compromisso de hoje em risco.',
    }
  }

  if (urgencia === 'COM_ALTERNATIVA') {
    return {
      prioridade: 'Media',
      justificativa: 'O problema atrapalha o trabalho, mas existe uma alternativa.',
    }
  }

  return {
    prioridade: 'Baixa',
    justificativa: 'É um pedido ou melhoria sem urgência informada.',
  }
}

export async function salvarRascunho(
  prisma: PrismaClient,
  usuarioId: string,
  conversaId: string,
  entrada: unknown,
) {
  const dados = rascunhoSchema.parse(entrada)

  const classificacao = classificarPrioridade(
    dados.impacto,
    dados.urgencia,
  )

  return prisma.$transaction(async (transacao) => {
    const conversa = await transacao.conversa.findFirst({
      where: {
        id: conversaId,
        usuarioId,
        status: 'COM_AGENTE',
      },
    })

    if (!conversa) {
      throw new Error('Conversa disponível para o agente não encontrada.')
    }

    const campos = {
      titulo: dados.titulo,
      descricao: dados.descricao,
      tipo: dados.tipo,
      categoria: dados.categoria,
      prioridade: classificacao.prioridade,
      afetados: dados.afetados,
    }

    const rascunho = await transacao.rascunhoChamado.upsert({
      where: { conversaId },
      create: {
        ...campos,
        conversaId,
      },
      update: campos,
    })

    return {
      rascunho,
      justificativaPrioridade: classificacao.justificativa,
    }
  })
}

export async function cancelarRascunho(
  prisma: PrismaClient,
  usuarioId: string,
  conversaId: string,
  rascunhoId: string,
) {
  return prisma.$transaction(async (transacao) => {
    const conversa = await transacao.conversa.findFirst({
      where: {
        id: conversaId,
        usuarioId,
      },
    })

    if (!conversa) {
      return { status: 'CONVERSA_NAO_ENCONTRADA' } as const
    }

    if (conversa.status !== 'COM_AGENTE') {
      return { status: 'CONVERSA_INDISPONIVEL' } as const
    }

    const exclusao = await transacao.rascunhoChamado.deleteMany({
      where: {
        id: rascunhoId,
        conversaId,
      },
    })

    if (exclusao.count === 0) {
      return { status: 'RASCUNHO_NAO_ENCONTRADO' } as const
    }

    const mensagem = await transacao.mensagem.create({
      data: {
        conversaId,
        autor: 'ASSISTENTE',
        texto:
          'O funcionário cancelou o rascunho. Nenhum chamado foi criado a partir dele.',
      },
    })

    await transacao.conversa.update({
      where: { id: conversaId },
      data: { atualizadoEm: new Date() },
    })

    return {
      status: 'CANCELADO',
      mensagem,
    } as const
  })
}

export const edicaoRascunhoSchema = z.object({
  titulo: z.string().trim().min(5).max(150),
  descricao: z.string().trim().min(10).max(2000),
})

export async function editarRascunho(
  prisma: PrismaClient,
  usuarioId: string,
  conversaId: string,
  rascunhoId: string,
  entrada: unknown,
) {
  const dados = edicaoRascunhoSchema.parse(entrada)

  return prisma.$transaction(async (transacao) => {
    const conversa = await transacao.conversa.findFirst({
      where: {
        id: conversaId,
        usuarioId,
      },
    })

    if (!conversa) {
      return { status: 'CONVERSA_NAO_ENCONTRADA' } as const
    }

    if (conversa.status !== 'COM_AGENTE') {
      return { status: 'CONVERSA_INDISPONIVEL' } as const
    }

    const rascunho = await transacao.rascunhoChamado.findFirst({
      where: {
        id: rascunhoId,
        conversaId,
      },
    })

    if (!rascunho) {
      return { status: 'RASCUNHO_NAO_ENCONTRADO' } as const
    }

    const atualizado = await transacao.rascunhoChamado.update({
      where: { id: rascunho.id },
      data: {
        titulo: dados.titulo,
        descricao: dados.descricao,
      },
    })

    const mensagem = await transacao.mensagem.create({
      data: {
        conversaId,
        autor: 'ASSISTENTE',
        texto:
          `O funcionário revisou o rascunho.\n` +
          `Título: ${atualizado.titulo}\n` +
          `Descrição: ${atualizado.descricao}\n` +
          'O rascunho continua aguardando confirmação.',
      },
    })

    await transacao.conversa.update({
      where: { id: conversaId },
      data: { atualizadoEm: new Date() },
    })

    return {
      status: 'EDITADO',
      rascunho: atualizado,
      mensagem,
    } as const
  })
}