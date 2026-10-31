-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Conversa" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'COM_AGENTE',
    "resumo" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "analistaId" TEXT,
    CONSTRAINT "Conversa_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Conversa_analistaId_fkey" FOREIGN KEY ("analistaId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Conversa" ("atualizadoEm", "criadoEm", "id", "resumo", "status", "usuarioId") SELECT "atualizadoEm", "criadoEm", "id", "resumo", "status", "usuarioId" FROM "Conversa";
DROP TABLE "Conversa";
ALTER TABLE "new_Conversa" RENAME TO "Conversa";
CREATE INDEX "Conversa_usuarioId_idx" ON "Conversa"("usuarioId");
CREATE TABLE "new_Usuario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "papel" TEXT NOT NULL DEFAULT 'FUNCIONARIO'
);
INSERT INTO "new_Usuario" ("criadoEm", "email", "id", "nome") SELECT "criadoEm", "email", "id", "nome" FROM "Usuario";
DROP TABLE "Usuario";
ALTER TABLE "new_Usuario" RENAME TO "Usuario";
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
