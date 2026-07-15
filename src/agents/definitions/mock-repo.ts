import type { MockRepo } from "@/types";

// A realistic small full-stack repo the Repository Onboarding workflow inspects.
// The Code Search Agent's tools (listRepoFiles, readFile, searchFiles,
// getPackageJson) read from this fixture. Kept intentionally rich so generated
// onboarding docs look specific and believable.
export const MOCK_REPO: MockRepo = {
  name: "taskflow-api",
  description:
    "A TypeScript REST API for a team task-management app, built with Express, Prisma, and PostgreSQL.",
  files: [
    {
      path: "package.json",
      content: JSON.stringify(
        {
          name: "taskflow-api",
          version: "1.4.0",
          description: "Team task-management REST API",
          main: "dist/index.js",
          scripts: {
            dev: "tsx watch src/index.ts",
            build: "tsc",
            start: "node dist/index.js",
            test: "vitest run",
            "db:migrate": "prisma migrate dev",
            lint: "eslint src",
          },
          dependencies: {
            express: "^4.19.2",
            "@prisma/client": "^5.18.0",
            zod: "^3.23.8",
            jsonwebtoken: "^9.0.2",
            bcryptjs: "^2.4.3",
            pino: "^9.3.2",
          },
          devDependencies: {
            typescript: "^5.5.4",
            tsx: "^4.16.5",
            prisma: "^5.18.0",
            vitest: "^2.0.5",
            eslint: "^9.9.0",
          },
        },
        null,
        2
      ),
    },
    {
      path: "README.md",
      content:
        "# TaskFlow API\n\nBackend service for the TaskFlow task-management product.\n\n## Quick start\n\n```bash\nnpm install\ncp .env.example .env\nnpm run db:migrate\nnpm run dev\n```\n\nThe server listens on `http://localhost:4000`.\n",
    },
    {
      path: "src/index.ts",
      content:
        "import express from 'express';\nimport { logger } from './lib/logger';\nimport { authRouter } from './routes/auth';\nimport { tasksRouter } from './routes/tasks';\nimport { errorHandler } from './middleware/error';\n\nconst app = express();\napp.use(express.json());\napp.use('/auth', authRouter);\napp.use('/tasks', tasksRouter);\napp.use(errorHandler);\n\nconst port = process.env.PORT ?? 4000;\napp.listen(port, () => logger.info(`API listening on :${port}`));\n",
    },
    {
      path: "src/routes/auth.ts",
      content:
        "import { Router } from 'express';\nimport { z } from 'zod';\nimport bcrypt from 'bcryptjs';\nimport jwt from 'jsonwebtoken';\nimport { prisma } from '../lib/prisma';\n\nexport const authRouter = Router();\n\nconst credentials = z.object({ email: z.string().email(), password: z.string().min(8) });\n\nauthRouter.post('/register', async (req, res) => {\n  const { email, password } = credentials.parse(req.body);\n  const passwordHash = await bcrypt.hash(password, 10);\n  const user = await prisma.user.create({ data: { email, passwordHash } });\n  res.status(201).json({ id: user.id });\n});\n\nauthRouter.post('/login', async (req, res) => {\n  const { email, password } = credentials.parse(req.body);\n  const user = await prisma.user.findUnique({ where: { email } });\n  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {\n    return res.status(401).json({ error: 'invalid credentials' });\n  }\n  const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET!);\n  res.json({ token });\n});\n",
    },
    {
      path: "src/routes/tasks.ts",
      content:
        "import { Router } from 'express';\nimport { z } from 'zod';\nimport { prisma } from '../lib/prisma';\nimport { requireAuth } from '../middleware/auth';\n\nexport const tasksRouter = Router();\ntasksRouter.use(requireAuth);\n\ntasksRouter.get('/', async (req, res) => {\n  const tasks = await prisma.task.findMany({ where: { ownerId: req.userId } });\n  res.json(tasks);\n});\n\nconst newTask = z.object({ title: z.string().min(1), dueAt: z.string().datetime().optional() });\ntasksRouter.post('/', async (req, res) => {\n  const data = newTask.parse(req.body);\n  const task = await prisma.task.create({ data: { ...data, ownerId: req.userId } });\n  res.status(201).json(task);\n});\n",
    },
    {
      path: "src/middleware/auth.ts",
      content:
        "import type { Request, Response, NextFunction } from 'express';\nimport jwt from 'jsonwebtoken';\n\ndeclare global {\n  namespace Express { interface Request { userId: string } }\n}\n\nexport function requireAuth(req: Request, res: Response, next: NextFunction) {\n  const header = req.headers.authorization;\n  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'missing token' });\n  try {\n    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET!) as { sub: string };\n    req.userId = payload.sub;\n    next();\n  } catch {\n    res.status(401).json({ error: 'invalid token' });\n  }\n}\n",
    },
    {
      path: "src/middleware/error.ts",
      content:
        "import type { Request, Response, NextFunction } from 'express';\nimport { ZodError } from 'zod';\nimport { logger } from '../lib/logger';\n\nexport function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {\n  if (err instanceof ZodError) return res.status(400).json({ error: err.flatten() });\n  logger.error(err);\n  res.status(500).json({ error: 'internal server error' });\n}\n",
    },
    {
      path: "src/lib/prisma.ts",
      content:
        "import { PrismaClient } from '@prisma/client';\nexport const prisma = new PrismaClient();\n",
    },
    {
      path: "src/lib/logger.ts",
      content:
        "import pino from 'pino';\nexport const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });\n",
    },
    {
      path: "prisma/schema.prisma",
      content:
        "datasource db {\n  provider = \"postgresql\"\n  url      = env(\"DATABASE_URL\")\n}\n\ngenerator client {\n  provider = \"prisma-client-js\"\n}\n\nmodel User {\n  id           String @id @default(cuid())\n  email        String @unique\n  passwordHash String\n  tasks        Task[]\n}\n\nmodel Task {\n  id      String   @id @default(cuid())\n  title   String\n  done    Boolean  @default(false)\n  dueAt   DateTime?\n  ownerId String\n  owner   User     @relation(fields: [ownerId], references: [id])\n}\n",
    },
    {
      path: ".env.example",
      content:
        "DATABASE_URL=postgresql://postgres:postgres@localhost:5432/taskflow\nJWT_SECRET=replace-me\nPORT=4000\nLOG_LEVEL=info\n",
    },
    {
      path: "tsconfig.json",
      content: JSON.stringify(
        {
          compilerOptions: {
            target: "ES2022",
            module: "NodeNext",
            moduleResolution: "NodeNext",
            outDir: "dist",
            strict: true,
            esModuleInterop: true,
            skipLibCheck: true,
          },
          include: ["src"],
        },
        null,
        2
      ),
    },
  ],
};
