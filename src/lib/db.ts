import { PrismaClient } from "@prisma/client";

// Prisma singleton — avoids exhausting DB connections during Next.js dev HMR,
// which otherwise instantiates a new client on every hot reload.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
