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

  const resposta = await agente.generate(pergunta)

  console.log('Resposta do Nexo Assist:')
  console.log(resposta.text)
}

testarAgente()
  .catch((erro) => {
    console.error('Erro ao testar o agente:', erro)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })