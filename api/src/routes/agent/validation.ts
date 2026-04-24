import { body, param } from 'express-validator';
import { List } from '../../@types/agent';
import validate from '../../middlewares/validator';
import AppDataSource from '../../data-source';
import { Agent } from '../../entities';

export const WORKSPACE_FILENAMES = [
  'AGENTS.md',
  'SOUL.md',
  'TOOLS.md',
  'IDENTITY.md',
  'USER.md',
  'HEARTBEAT.md',
  'BOOTSTRAP.md',
  'MEMORY.md',
] as const;

export default {
  sanitizeQuery: ((req, res, next) => {
    req.query.page = (req.query.page as number) >= 0 ? req.query.page : 0;
    req.query.limit = [5, 10, 20, 40, 60, 100].includes(+(req.query.limit as number))
      ? req.query.limit
      : 40;
    req.query.sortType = ['asc', 'desc'].includes(req.query.sortType as string)
      ? req.query.sortType
      : 'desc';
    req.query.sortField = ['name', 'createdAt', 'updatedAt'].includes(req.query.sortField as string)
      ? req.query.sortField
      : 'createdAt';
    return next();
  }) as List,

  id: validate([param('id').isInt().withMessage('Incorrect request url')]),

  create: validate([
    body('name')
      .notEmpty()
      .withMessage('Please enter the agent name')
      .isLength({ min: 1, max: 100 })
      .withMessage('Agent name must contain between 1 and 100 characters')
      .custom(async (name) => {
        const agentRepo = AppDataSource.getRepository(Agent);
        const existing = await agentRepo.findOneBy({ name });
        if (existing) throw new Error('An agent with this name already exists');
      }),
  ]),

  update: validate([
    param('id').isInt().withMessage('Incorrect request url'),
    body('name')
      .notEmpty()
      .withMessage('Please enter the agent name')
      .isLength({ min: 1, max: 100 })
      .withMessage('Agent name must contain between 1 and 100 characters'),
  ]),

  workspaceFilename: validate([
    param('id').isInt().withMessage('Incorrect request url'),
    param('filename')
      .isIn([...WORKSPACE_FILENAMES])
      .withMessage('Invalid workspace file'),
  ]),

  workspacePut: validate([
    param('id').isInt().withMessage('Incorrect request url'),
    param('filename')
      .isIn([...WORKSPACE_FILENAMES])
      .withMessage('Invalid workspace file'),
    body('content').isString().withMessage('content is required'),
  ]),

  skillsPatch: validate([
    param('id').isInt().withMessage('Incorrect request url'),
    body('skills').custom((value) => {
      if (value === null || value === undefined) return true;
      if (!Array.isArray(value)) {
        throw new Error('"skills" must be an array of strings or null.');
      }
      if (value.some((item) => typeof item !== 'string')) {
        throw new Error('Every skill must be a string.');
      }
      return true;
    }),
  ]),

  subagentsPatch: validate([
    param('id').isInt().withMessage('Incorrect request url'),
    body().custom((value) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Body must be an object.');
      }
      const allowed = ['allowAgents', 'thinking', 'requireAgentId'];
      const unknownKey = Object.keys(value).find((k) => !allowed.includes(k));
      if (unknownKey) {
        throw new Error(`Unknown field: ${unknownKey}`);
      }
      const v = value as Record<string, unknown>;
      if ('allowAgents' in v && v.allowAgents !== null) {
        if (!Array.isArray(v.allowAgents)) {
          throw new Error('"allowAgents" must be an array or null.');
        }
        if (v.allowAgents.some((x) => typeof x !== 'string')) {
          throw new Error('Every allowed agent id must be a string.');
        }
      }
      if ('thinking' in v && v.thinking !== null && typeof v.thinking !== 'string') {
        throw new Error('"thinking" must be a string or null.');
      }
      if (
        'requireAgentId' in v &&
        v.requireAgentId !== null &&
        typeof v.requireAgentId !== 'boolean'
      ) {
        throw new Error('"requireAgentId" must be a boolean or null.');
      }
      return true;
    }),
  ]),

  budgetPatch: validate([
    param('id').isInt().withMessage('Incorrect request url'),
    body().custom((value) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Body must be an object of budget fields.');
      }
      const allowedKeys = [
        'memoryGetMaxChars',
        'memoryGetDefaultLines',
        'toolResultMaxChars',
        'postCompactionMaxChars',
        'maxSkillsPromptChars',
      ];
      Object.entries(value).forEach(([key, entryVal]) => {
        if (!allowedKeys.includes(key)) {
          throw new Error(`Unknown budget field: ${key}`);
        }
        if (entryVal === null) return;
        if (typeof entryVal !== 'number' || !Number.isInteger(entryVal) || entryVal < 0) {
          throw new Error(`"${key}" must be a non-negative integer or null.`);
        }
      });
      return true;
    }),
  ]),

  providerModelPatch: validate([
    param('id').isInt().withMessage('Incorrect request url'),
    body().custom((value) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Body must be an object.');
      }
      const v = value as Record<string, unknown>;
      const allowed = ['model', 'conversationId'];
      const unknown = Object.keys(v).find((k) => !allowed.includes(k));
      if (unknown) throw new Error(`Unknown field: ${unknown}`);
      if (typeof v.model !== 'string' || !v.model.trim()) {
        throw new Error('"model" must be a non-empty string.');
      }
      if (v.conversationId !== undefined && v.conversationId !== null) {
        const n = Number(v.conversationId);
        if (!Number.isInteger(n) || n <= 0) {
          throw new Error('"conversationId" must be a positive integer when provided.');
        }
      }
      return true;
    }),
  ]),
};
