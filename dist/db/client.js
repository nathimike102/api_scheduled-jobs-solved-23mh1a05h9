"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
// Instantiate a single PrismaClient globally to avoid connection exhaustion in dev
const prisma = new client_1.PrismaClient();
exports.default = prisma;
