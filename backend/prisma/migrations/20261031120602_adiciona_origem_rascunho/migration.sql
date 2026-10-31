/*
  Warnings:

  - A unique constraint covering the columns `[origemRascunhoId]` on the table `Chamado` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Chamado" ADD COLUMN "origemRascunhoId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Chamado_origemRascunhoId_key" ON "Chamado"("origemRascunhoId");
