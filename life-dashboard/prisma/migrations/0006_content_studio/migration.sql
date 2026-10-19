-- AlterTable
ALTER TABLE "ContentPost" ADD COLUMN "comments" INTEGER,
ADD COLUMN "likes" INTEGER,
ADD COLUMN "shares" INTEGER,
ADD COLUMN "views" INTEGER;

-- CreateTable
CREATE TABLE "Competitor" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "handle" TEXT,
    "url" TEXT,
    "notes" TEXT,
    "mine" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Competitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitorSnapshot" (
    "id" TEXT NOT NULL,
    "competitorId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "followers" INTEGER NOT NULL,
    "avgViews" INTEGER,
    "posts" INTEGER,

    CONSTRAINT "CompetitorSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Competitor_userId_idx" ON "Competitor"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitorSnapshot_competitorId_date_key" ON "CompetitorSnapshot"("competitorId", "date");

-- AddForeignKey
ALTER TABLE "Competitor" ADD CONSTRAINT "Competitor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorSnapshot" ADD CONSTRAINT "CompetitorSnapshot_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "Competitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
