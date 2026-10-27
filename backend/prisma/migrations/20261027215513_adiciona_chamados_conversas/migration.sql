-- CreateTable
CREATE TABLE "Chamado" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "numero" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "prioridade" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "afetados" TEXT NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    "resolvidoEm" DATETIME,
    "usuarioId" TEXT NOT NULL,
    CONSTRAINT "Chamado_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Conversa" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'COM_AGENTE',
    "resumo" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    "usuarioId" TEXT NOT NULL,
    CONSTRAINT "Conversa_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Mensagem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "autor" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conversaId" TEXT NOT NULL,
    CONSTRAINT "Mensagem_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "Conversa" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Chamado_numero_key" ON "Chamado"("numero");

-- CreateIndex
CREATE INDEX "Chamado_usuarioId_idx" ON "Chamado"("usuarioId");

-- CreateIndex
CREATE INDEX "Conversa_usuarioId_idx" ON "Conversa"("usuarioId");

-- CreateIndex
CREATE INDEX "Mensagem_conversaId_idx" ON "Mensagem"("conversaId");
