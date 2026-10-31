-- CreateTable
CREATE TABLE "ConfirmacaoRascunho" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rascunhoId" TEXT NOT NULL,
    "conversaId" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "chamadoId" TEXT NOT NULL,
    CONSTRAINT "ConfirmacaoRascunho_chamadoId_fkey" FOREIGN KEY ("chamadoId") REFERENCES "Chamado" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ConfirmacaoRascunho_rascunhoId_key" ON "ConfirmacaoRascunho"("rascunhoId");

-- CreateIndex
CREATE INDEX "ConfirmacaoRascunho_conversaId_idx" ON "ConfirmacaoRascunho"("conversaId");
