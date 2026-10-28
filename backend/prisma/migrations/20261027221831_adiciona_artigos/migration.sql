-- CreateTable
CREATE TABLE "Artigo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "titulo" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Artigo_titulo_key" ON "Artigo"("titulo");
