import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { criarNexoAgent } from './nexoAgent'

const prisma = new PrismaClient()

async function testarAgente() {
  if (!process.env.GOOGLE_API_KEY) {
    throw new Error('A variável GOOGLE_API_KEY não foi configurada.')
  }

  const usuario = await prisma.usuario.findUniqueOrThrow({
    where: { email: 'ana.souza@nexo.com.br' },
  })

  const agente = criarNexoAgent(prisma, usuario.id)

  const pergunta =
    process.argv[2] || 'Qual é o status dos meus chamados?'

  const sinal = AbortSignal.timeout(60_000)

const resposta = await agente.generate(pergunta, {
  maxSteps: 5,
  toolChoice: 'auto',
  abortSignal: sinal,
  modelSettings: {
    maxRetries: 0,
    maxOutputTokens: 1024,
  },
})

sinal.throwIfAborted()

if (resposta.finishReason === 'aborted' || !resposta.text.trim()) {
  throw new Error('O agente terminou sem uma resposta completa.')
}

  console.log('Resposta do Nexo Assist:')
  console.log(resposta.text)
  console.log('Motivo do término:', resposta.finishReason)

console.dir(
  resposta.steps.map((etapa) => ({
    motivo: etapa.finishReason,
    texto: etapa.text,
    ferramentas: etapa.toolCalls,
  })),
  { depth: 4 },
)
}

testarAgente()
  .catch((erro) => {
    console.error('Erro ao testar o agente:', erro)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })