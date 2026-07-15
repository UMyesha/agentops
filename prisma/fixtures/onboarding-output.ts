import type { OnboardingDoc } from "@/types";

// The "good" onboarding document produced by the seeded COMPLETED run.
// Kept as a fixture so the seed and (later) the mock provider can share it.
export const SEEDED_ONBOARDING_DOC: OnboardingDoc = {
  projectOverview:
    "TaskFlow API is a TypeScript REST backend for a team task-management product. It exposes authentication and task CRUD endpoints, built on Express 4, Prisma 5, and PostgreSQL. Authentication uses JWTs issued at login; passwords are hashed with bcrypt.",
  setupInstructions:
    "1. Run `npm install`.\n2. Copy `.env.example` to `.env` and set `DATABASE_URL` and `JWT_SECRET`.\n3. Apply the schema with `npm run db:migrate`.\n4. Start the dev server with `npm run dev` (tsx watch). The API listens on http://localhost:4000.\nRun tests with `npm test` (Vitest).",
  folderStructure:
    "src/index.ts — app entry & route mounting\nsrc/routes/ — auth.ts and tasks.ts route handlers\nsrc/middleware/ — auth.ts (JWT guard) and error.ts (central error handler)\nsrc/lib/ — prisma.ts (DB client) and logger.ts (pino)\nprisma/schema.prisma — User and Task models",
  keyFiles: [
    {
      path: "src/index.ts",
      explanation:
        "Bootstraps Express, mounts the /auth and /tasks routers, and registers the error handler. Reads PORT from the environment (defaults to 4000).",
    },
    {
      path: "src/routes/auth.ts",
      explanation:
        "Handles /register and /login. Validates input with Zod, hashes passwords with bcrypt, and signs a JWT on successful login.",
    },
    {
      path: "src/middleware/auth.ts",
      explanation:
        "requireAuth middleware verifies the Bearer JWT and attaches req.userId. All /tasks routes are protected by it.",
    },
    {
      path: "prisma/schema.prisma",
      explanation:
        "Defines the User and Task models. Task has an ownerId relation to User, enforcing per-user task ownership.",
    },
  ],
  developmentWorkflow:
    "Develop against a local Postgres instance. Use `npm run dev` for hot-reloading via tsx. Schema changes go through `prisma migrate dev`. Lint with `npm run lint` (ESLint) and run the Vitest suite with `npm test` before opening a PR.",
};
