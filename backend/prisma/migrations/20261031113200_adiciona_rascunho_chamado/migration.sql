-- CreateTable
CREATE TABLE "RascunhoChamado" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "prioridade" TEXT NOT NULL,
    "afetados" TEXT NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    "conversaId" TEXT NOT NULL,
    CONSTRAINT "RascunhoChamado_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "Conversa" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "RascunhoChamado_conversaId_key" ON "RascunhoChamado"("conversaId");
