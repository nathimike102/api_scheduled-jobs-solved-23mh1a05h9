import { PrismaClient } from '@prisma/client'

// Instantiate a single PrismaClient globally to avoid connection exhaustion in dev
const prisma = new PrismaClient()

export default prisma
