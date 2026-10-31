-- CreateTable
CREATE TABLE "AcaoAgente" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "entrada" TEXT NOT NULL,
    "resultado" TEXT NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mensagemId" TEXT NOT NULL,
    CONSTRAINT "AcaoAgente_mensagemId_fkey" FOREIGN KEY ("mensagemId") REFERENCES "Mensagem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AcaoAgente_mensagemId_idx" ON "AcaoAgente"("mensagemId");
