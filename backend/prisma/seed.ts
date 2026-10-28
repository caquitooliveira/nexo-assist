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

  const artigos = [
  {
    titulo: 'VPN com erro 809',
    conteudo:
      'No Windows 10, reinstale o cliente de VPN pelo portal de softwares e reinicie o computador. No Windows 11, abra um chamado para o suporte.',
  },
  {
    titulo: 'Horário do service desk',
    conteudo:
      'O atendimento funciona de segunda a sexta-feira, das 8h às 18h. Chamados críticos têm plantão 24 horas.',
  },
  {
    titulo: 'Redefinição da senha de rede',
    conteudo:
      'Acesse o portal de senhas da Nexo e siga as instruções para redefinir sua senha de rede. Se não conseguir acessar o portal, solicite ajuda ao service desk.',
  },
  {
    titulo: 'Instalação de softwares',
    conteudo:
      'Acesse o portal de softwares da Nexo para instalar aplicativos já aprovados. Para solicitar um programa que não está disponível, abra uma requisição.',
  },
  {
    titulo: 'E-mail não sincroniza',
    conteudo:
      'Verifique sua conexão com a internet e reinicie o aplicativo de e-mail. Se o problema continuar, procure o service desk.',
  },
  {
    titulo: 'Acesso à rede Wi-Fi',
    conteudo:
      'Selecione a rede corporativa Nexo e entre com suas credenciais de rede. Se não conseguir conectar, entre em contato com o service desk.',
  },
]

for (const artigo of artigos) {
  await prisma.artigo.upsert({
    where: { titulo: artigo.titulo },
    update: { conteudo: artigo.conteudo },
    create: artigo,
  })
}

  console.log('Usuários, chamados e artigos de exemplo cadastrados.')
}

main()
  .catch((erro) => {
    console.error('Erro ao cadastrar dados de exemplo:', erro)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })