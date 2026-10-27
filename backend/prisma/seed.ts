import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const usuarios = [
    { nome: 'Ana Souza', email: 'ana.souza@nexo.com.br' },
    { nome: 'Bruno Tavares', email: 'bruno.tavares@nexo.com.br' },
    { nome: 'Carla Mendes', email: 'carla.mendes@nexo.com.br' },
  ]

  for (const usuario of usuarios) {
    await prisma.usuario.upsert({
      where: { email: usuario.email },
      update: { nome: usuario.nome },
      create: usuario,
    })
  }

  const ana = await prisma.usuario.findUniqueOrThrow({
    where: { email: 'ana.souza@nexo.com.br' },
  })

  const bruno = await prisma.usuario.findUniqueOrThrow({
    where: { email: 'bruno.tavares@nexo.com.br' },
  })

  const agora = new Date()
  const diasAtras = (dias: number) =>
    new Date(agora.getTime() - dias * 24 * 60 * 60 * 1000)

  const chamados = [
    {
      numero: 'INC-20311',
      titulo: 'Notebook lento após atualização do Windows',
      descricao:
        'O notebook ficou lento após a atualização. Reiniciar não resolveu o problema.',
      tipo: 'INC',
      categoria: 'Hardware',
      prioridade: 'Media',
      status: 'AGUARDANDO_ANALISTA',
      afetados: 'Somente Ana',
      usuarioId: ana.id,
      criadoEm: diasAtras(10),
      atualizadoEm: diasAtras(8),
      resolvidoEm: null,
    },
    {
      numero: 'REQ-10442',
      titulo: 'Segundo monitor para home office',
      descricao:
        'Solicitação de um segundo monitor para melhorar o trabalho em home office.',
      tipo: 'REQ',
      categoria: 'Hardware',
      prioridade: 'Baixa',
      status: 'APROVADO',
      afetados: 'Somente Ana',
      usuarioId: ana.id,
      criadoEm: diasAtras(3),
      atualizadoEm: diasAtras(1),
      resolvidoEm: null,
    },
    {
      numero: 'INC-20150',
      titulo: 'Senha do SAP bloqueada',
      descricao: 'A senha do SAP foi bloqueada após tentativas de acesso.',
      tipo: 'INC',
      categoria: 'Acesso',
      prioridade: 'Media',
      status: 'RESOLVIDO',
      afetados: 'Somente Ana',
      usuarioId: ana.id,
      criadoEm: diasAtras(6),
      atualizadoEm: diasAtras(4),
      resolvidoEm: diasAtras(4),
    },
    {
      numero: 'INC-20312',
      titulo: 'E-mail não sincroniza no celular',
      descricao: 'O aplicativo de e-mail não recebe novas mensagens no celular.',
      tipo: 'INC',
      categoria: 'E-mail',
      prioridade: 'Media',
      status: 'EM_ANDAMENTO',
      afetados: 'Somente Bruno',
      usuarioId: bruno.id,
      criadoEm: diasAtras(2),
      atualizadoEm: diasAtras(1),
      resolvidoEm: null,
    },
  ]

  for (const chamado of chamados) {
    await prisma.chamado.upsert({
      where: { numero: chamado.numero },
      update: {},
      create: chamado,
    })
  }

  console.log('Usuários e chamados de exemplo cadastrados com sucesso.')
}

main()
  .catch((erro) => {
    console.error('Erro ao cadastrar dados de exemplo:', erro)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })