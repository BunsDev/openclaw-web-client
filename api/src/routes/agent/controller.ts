import { In, IsNull, Not } from 'typeorm';
import { RequestHandler } from 'express';
import { AppDataSource } from '../../data-source';
import { Agent, Conversation, Message } from '../../entities';
import { MessageRole } from '../../@types/message';
import { List, Get, Create, Update, Destroy } from '../../@types/agent';
import * as ocService from '../../services/openclawService';

const list: List = async (req, res, next) => {
  try {
    const { page = 0, limit = 40, sortField = 'createdAt', sortType = 'desc' } = req.query;
    const agentRepo = AppDataSource.getRepository(Agent);

    const qb = agentRepo.createQueryBuilder('agent');

    if (req.query.search) {
      const search = req.query.search as string;
      if (!isNaN(Number(search))) {
        qb.andWhere('agent._id = :id', { id: Number(search) });
      } else {
        qb.andWhere('agent.name LIKE :s', { s: `%${search}%` });
      }
    }

    const total = await qb.getCount();
    const items = await qb
      .skip(Number(page) * Number(limit))
      .take(Number(limit))
      .orderBy(`agent.${sortField as string}`, (sortType as string).toUpperCase() === 'ASC' ? 'ASC' : 'DESC')
      .getMany();

    return res.json({ total, items });
  } catch (error) {
    return next(error);
  }
};

const get: Get = async (req, res, next) => {
  try {
    const agentRepo = AppDataSource.getRepository(Agent);
    const agent = await agentRepo.findOneBy({ _id: Number(req.params.id) });
    return res.json(agent);
  } catch (error) {
    return next(error);
  }
};

const create: Create = async (req, res, next) => {
  try {
    const agentRepo = AppDataSource.getRepository(Agent);
    const openclawAgentId = req.body.openclawAgentId?.trim() || toSlug(req.body.name || '');
    const agent = agentRepo.create({
      ...req.body,
      openclawAgentId,
      createdBy: req.user!._id,
      createdAt: new Date(),
    });
    const saved = await agentRepo.save(agent);

    ocService.registerAgent(openclawAgentId);

    return res.json(saved);
  } catch (error) {
    return next(error);
  }
};

const update: Update = async (req, res, next) => {
  try {
    const agentRepo = AppDataSource.getRepository(Agent);
    const id = Number(req.params.id);

    await agentRepo.update(id, { name: req.body.name, updatedAt: new Date() });
    const agent = await agentRepo.findOneBy({ _id: id });
    if (!agent) return res.status(404).json(null);

    if (agent.openclawAgentId) {
      ocService.setAgentIdentity(agent.openclawAgentId, req.body.name || '');
    }

    return res.json(agent);
  } catch (error) {
    return next(error);
  }
};

const destroy: Destroy = async (req, res, next) => {
  try {
    const agentRepo = AppDataSource.getRepository(Agent);
    const convRepo = AppDataSource.getRepository(Conversation);
    const id = Number(req.params.id);

    const agent = await agentRepo.findOneBy({ _id: id });
    await agentRepo.softDelete(id);
    await convRepo.createQueryBuilder()
      .update(Conversation)
      .set({ deletedAt: new Date() })
      .where('agentId = :id', { id })
      .execute();

    if (agent?.openclawAgentId) {
      ocService.removeAgent(agent.openclawAgentId);
    }

    return res.json(null);
  } catch (error) {
    return next(error);
  }
};

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'agent';
}

const sync: RequestHandler = async (req, res, next) => {
  try {
    const agentRepo = AppDataSource.getRepository(Agent);
    const convRepo = AppDataSource.getRepository(Conversation);
    const msgRepo = AppDataSource.getRepository(Message);

    // Phase 1: Sync agents (filesystem scan, no CLI)
    const openclawAgents = ocService.listAgents();
    let syncedAgents = 0;

    if (openclawAgents.length) {
      const existingAgents = await agentRepo.find({
        where: { openclawAgentId: In(openclawAgents.map((a) => a.agentId)) },
      });
      const existingAgentIds = new Set(existingAgents.map((a) => a.openclawAgentId));

      const newAgents = openclawAgents.filter((a) => !existingAgentIds.has(a.agentId));
      if (newAgents.length) {
        await agentRepo.save(
          newAgents.map((a) => agentRepo.create({
            name: a.name,
            openclawAgentId: a.agentId,
            createdBy: req.user!._id,
            createdAt: new Date(),
          })),
        );
        syncedAgents = newAgents.length;
      }
    }

    // Phase 2: Sync conversations (skip JSONL parsing for first messages)
    const allAgents = await agentRepo.find();
    let syncedConversations = 0;

    for (const agent of allAgents) {
      try {
        const sessions = ocService.listSessions(agent.openclawAgentId, true);
        if (!sessions.length) continue;

        const existingConvs = await convRepo.find({
          where: {
            agentId: agent._id,
            sessionKey: In(sessions.map((s) => s.sessionKey)),
          },
        });
        const existingByKey = new Map(existingConvs.map((c) => [c.sessionKey, c]));

        const newSessions = sessions.filter((s) => !existingByKey.get(s.sessionKey));
        if (newSessions.length) {
          await convRepo.save(
            newSessions.map((s) => convRepo.create({
              agentId: agent._id,
              sessionKey: s.sessionKey,
              title: s.label || null,
              createdBy: req.user!._id,
              createdAt: s.updatedAt ? new Date(s.updatedAt) : new Date(),
            })),
          );
          syncedConversations += newSessions.length;
        }

        // Update titles for conversations that don't have one yet
        for (const s of sessions) {
          const existing = existingByKey.get(s.sessionKey);
          if (existing && !existing.title && s.label) {
            await convRepo.update(existing._id, { title: s.label });
          }
        }
      } catch {
        // skip agents whose sessions can't be read
      }
    }

    // Phase 3: Sync messages (only for conversations missing messages)
    const allConversations = await convRepo.find({
      where: { sessionKey: Not(IsNull()) },
    });
    let syncedMessages = 0;

    const agentMap = new Map(allAgents.map((a) => [a._id, a]));

    // Get message counts per conversation in one query
    const msgCounts: { conversationId: number; cnt: string }[] = await msgRepo
      .createQueryBuilder('m')
      .select('m.conversationId', 'conversationId')
      .addSelect('COUNT(*)', 'cnt')
      .where('m.conversationId IN (:...ids)', {
        ids: allConversations.map((c) => c._id),
      })
      .groupBy('m.conversationId')
      .getRawMany();
    const countMap = new Map(msgCounts.map((r) => [r.conversationId, Number(r.cnt)]));

    for (const conv of allConversations) {
      try {
        const agent = agentMap.get(conv.agentId);
        if (!agent) continue;

        const openclawMessages = ocService.getSessionMessages(agent.openclawAgentId, conv.sessionKey!);
        const validMessages = openclawMessages.filter((m) => m.externalId);
        if (!validMessages.length) continue;

        const dbCount = countMap.get(conv._id) || 0;
        if (dbCount >= validMessages.length) continue;

        const existingIds = new Set(
          (await msgRepo.find({
            where: { conversationId: conv._id },
            select: ['externalId'],
          })).map((m) => m.externalId),
        );

        const toInsert = validMessages.filter((m) => !existingIds.has(m.externalId));
        if (!toInsert.length) continue;

        await msgRepo.save(
          toInsert.map((m) => msgRepo.create({
            conversationId: conv._id,
            externalId: m.externalId,
            text: m.text,
            thinking: m.thinking || null,
            files: [],
            role: m.role as MessageRole,
            createdBy: req.user!._id,
            createdAt: m.timestamp ? new Date(m.timestamp) : new Date(),
          })),
        );
        syncedMessages += toInsert.length;
      } catch {
        // skip conversations whose messages can't be read
      }
    }

    return res.json({ syncedAgents, syncedConversations, syncedMessages });
  } catch (error) {
    return next(error);
  }
};

const workspaceMeta: RequestHandler = async (req, res, next) => {
  try {
    const agentRepo = AppDataSource.getRepository(Agent);
    const agent = await agentRepo.findOneBy({ _id: Number(req.params.id) });
    if (!agent?.openclawAgentId) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    return res.json(ocService.getWorkspaceMeta(agent.openclawAgentId));
  } catch (error) {
    return next(error);
  }
};

const getWorkspaceFile: RequestHandler = async (req, res, next) => {
  try {
    const agentRepo = AppDataSource.getRepository(Agent);
    const agent = await agentRepo.findOneBy({ _id: Number(req.params.id) });
    if (!agent?.openclawAgentId) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    return res.json(ocService.getWorkspaceFile(agent.openclawAgentId, req.params.filename));
  } catch (error) {
    return next(error);
  }
};

const getSessionSettings: RequestHandler = async (req, res, next) => {
  try {
    const agentRepo = AppDataSource.getRepository(Agent);
    const convRepo = AppDataSource.getRepository(Conversation);

    const agent = await agentRepo.findOneBy({ _id: Number(req.params.id) });
    if (!agent?.openclawAgentId) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    const conv = await convRepo.findOneBy({ _id: Number(req.params.conversationId) });
    if (!conv?.sessionKey) {
      return res.json({ ok: true, settings: {} });
    }
    const settings = ocService.getSessionSettings(agent.openclawAgentId, conv.sessionKey);
    return res.json({ ok: true, settings });
  } catch (error) {
    return next(error);
  }
};

const patchSessionSettings: RequestHandler = async (req, res, next) => {
  try {
    const agentRepo = AppDataSource.getRepository(Agent);
    const convRepo = AppDataSource.getRepository(Conversation);

    const agent = await agentRepo.findOneBy({ _id: Number(req.params.id) });
    if (!agent?.openclawAgentId) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    const conv = await convRepo.findOneBy({ _id: Number(req.params.conversationId) });
    const sessionKey = conv?.sessionKey || String(conv?._id);
    const result = await ocService.patchSessionSettings(agent.openclawAgentId, sessionKey, req.body);
    if (!result.ok) {
      return res.status(500).json(result);
    }
    return res.json(result);
  } catch (error) {
    return next(error);
  }
};

const putWorkspaceFile: RequestHandler = async (req, res, next) => {
  try {
    const agentRepo = AppDataSource.getRepository(Agent);
    const agent = await agentRepo.findOneBy({ _id: Number(req.params.id) });
    if (!agent?.openclawAgentId) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    const { content } = req.body as { content: string };
    const result = ocService.putWorkspaceFile(agent.openclawAgentId, req.params.filename, content);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
};

const serveWorkspaceUpload: RequestHandler = async (req, res, next) => {
  try {
    const agentRepo = AppDataSource.getRepository(Agent);
    const agent = await agentRepo.findOneBy({ _id: Number(req.params.id) });
    if (!agent?.openclawAgentId) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    const fp = ocService.getWorkspaceUploadPath(agent.openclawAgentId, req.params.filename);
    if (!fp) return res.status(404).json({ error: 'File not found' });
    return res.sendFile(fp);
  } catch (error) {
    return next(error);
  }
};

export {
  list,
  get,
  create,
  update,
  destroy,
  sync,
  workspaceMeta,
  getWorkspaceFile,
  putWorkspaceFile,
  getSessionSettings,
  patchSessionSettings,
  serveWorkspaceUpload,
};
