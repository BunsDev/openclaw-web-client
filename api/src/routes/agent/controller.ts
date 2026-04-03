import { Types } from 'mongoose';
import { RequestHandler } from 'express';
import Agent from '../../models/agent';
import Conversation from '../../models/conversation';
import Message from '../../models/message';
import { MessageRole } from '../../@types/message';
import { List, Get, Create, Update, Destroy } from '../../@types/agent';

const OPENCLAW_PROXY_URL = process.env.OPENCLAW_PROXY_URL || 'http://localhost:18801';

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'agent';
}

const list: List = async (req, res, next) => {
  try {
    const { page = 0, limit = 40, sortField = 'createdAt', sortType = 'desc' } = req.query;
    const query = Agent.find();

    if (req.query.search) {
      const regexp = new RegExp(`.*${req.query.search}.*`, 'i');
      if (Types.ObjectId.isValid(req.query.search as string)) query.where({ _id: req.query.search });
      else query.or([{ name: regexp }]);
    }

    const total = await query.clone().skip(0).countDocuments();
    const items = await query.skip(page * limit).limit(limit).collation({ locale: 'en' }).sort({ [sortField]: sortType }).exec();

    return res.json({ total, items });
  } catch (error) {
    return next(error);
  }
};

const get: Get = async (req, res, next) => {
  try {
    const agent = await Agent.findById(req.params.id).lean();
    return res.json(agent);
  } catch (error) {
    return next(error);
  }
};

const create: Create = async (req, res, next) => {
  try {
    const openclawAgentId = req.body.openclawAgentId?.trim() || toSlug(req.body.name || '');
    const agent = new Agent({ ...req.body, openclawAgentId, createdBy: req.user!._id, createdAt: new Date() });
    const saved = await agent.save();

    fetch(`${OPENCLAW_PROXY_URL}/api/agents/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: openclawAgentId }),
    }).catch((err) => console.warn('Failed to register agent with OpenClaw:', err));

    return res.json(saved);
  } catch (error) {
    return next(error);
  }
};

const update: Update = async (req, res, next) => {
  try {
    const agent = await Agent.findByIdAndUpdate(
      req.params.id,
      { name: req.body.name, updatedAt: new Date() },
      { new: true },
    ).lean();
    if (!agent) return res.status(404).json(null);

    if (agent.openclawAgentId) {
      fetch(`${OPENCLAW_PROXY_URL}/api/agents/set-identity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: agent.openclawAgentId, name: req.body.name }),
      }).catch((err) => console.warn('Failed to update agent identity in OpenClaw:', err));
    }

    return res.json(agent);
  } catch (error) {
    return next(error);
  }
};

const destroy: Destroy = async (req, res, next) => {
  try {
    const agent = await Agent.findByIdAndUpdate(req.params.id, { deletedAt: new Date() }).lean();
    await Conversation.updateMany({ agentId: req.params.id }, { deletedAt: new Date() });

    if (agent?.openclawAgentId) {
      fetch(`${OPENCLAW_PROXY_URL}/api/agents/remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: agent.openclawAgentId }),
      }).catch((err) => console.warn('Failed to remove agent from OpenClaw:', err));
    }

    return res.json(null);
  } catch (error) {
    return next(error);
  }
};

const sync: RequestHandler = async (req, res, next) => {
  try {
    const proxyRes = await fetch(`${OPENCLAW_PROXY_URL}/api/agents/list`);
    if (!proxyRes.ok) {
      return res.status(502).json({ error: 'Failed to reach OpenClaw proxy' });
    }

    const { agents: openclawAgents } = await proxyRes.json() as {
      ok: boolean;
      agents: { agentId: string; name: string }[];
    };

    let syncedAgents = 0;

    if (openclawAgents?.length) {
      const existingAgentIds = new Set(
        (await Agent.find({ openclawAgentId: { $in: openclawAgents.map((a) => a.agentId) } }).lean())
          .map((a) => a.openclawAgentId),
      );

      const newAgents = openclawAgents.filter((a) => !existingAgentIds.has(a.agentId));
      await Promise.all(
        newAgents.map((a) => new Agent({
          name: a.name,
          openclawAgentId: a.agentId,
          createdBy: req.user!._id,
          createdAt: new Date(),
        }).save()),
      );
      syncedAgents = newAgents.length;
    }

    const allAgents = await Agent.find().lean();

    let syncedConversations = 0;

    await Promise.all(
      allAgents.map(async (agent) => {
        try {
          const sessRes = await fetch(
            `${OPENCLAW_PROXY_URL}/api/agents/${encodeURIComponent(agent.openclawAgentId)}/sessions`,
          );
          if (!sessRes.ok) return;

          const { sessions } = await sessRes.json() as {
            ok: boolean;
            sessions: { sessionKey: string; sessionId: string; updatedAt: number; firstMessage: string | null }[];
          };

          if (!sessions?.length) return;

          const existingConvs = await Conversation.find({
            agentId: agent._id,
            sessionKey: { $in: sessions.map((s) => s.sessionKey) },
          }).lean();
          const existingByKey = new Map(existingConvs.map((c) => [c.sessionKey, c]));

          const unlinkedConvs = await Conversation.find({
            agentId: agent._id,
            sessionKey: null,
          }).lean();

          await Promise.all(
            sessions.map(async (s) => {
              const existing = existingByKey.get(s.sessionKey);
              if (!existing) {
                const adoptable = s.firstMessage
                  ? unlinkedConvs.find((c) => c.title && c.title === s.firstMessage)
                  : unlinkedConvs.find((c) => !c.title);

                if (adoptable) {
                  await Conversation.findByIdAndUpdate(adoptable._id, {
                    sessionKey: s.sessionKey,
                    title: adoptable.title || s.firstMessage || null,
                  });
                  syncedConversations += 1;
                } else {
                  const upserted = await Conversation.findOneAndUpdate(
                    { agentId: agent._id, sessionKey: s.sessionKey, deletedAt: null },
                    { $setOnInsert: {
                      agentId: agent._id,
                      sessionKey: s.sessionKey,
                      title: s.firstMessage || null,
                      createdBy: req.user!._id,
                      createdAt: s.updatedAt ? new Date(s.updatedAt) : new Date(),
                    } },
                    { upsert: true, new: true },
                  );
                  if (upserted) syncedConversations += 1;
                }
              } else if (!existing.title && s.firstMessage) {
                await Conversation.findByIdAndUpdate(existing._id, { title: s.firstMessage });
              }
            }),
          );
        } catch {
          // skip agents whose sessions can't be fetched
        }
      }),
    );

    const allConversations = await Conversation.find({ sessionKey: { $ne: null } }).lean();

    let syncedMessages = 0;

    await Promise.all(
      allConversations.map(async (conv) => {
        try {
          const agent = allAgents.find((a) => String(a._id) === String(conv.agentId));
          if (!agent) return;

          const msgRes = await fetch(
            `${OPENCLAW_PROXY_URL}/api/agents/${encodeURIComponent(agent.openclawAgentId)}/sessions/${encodeURIComponent(conv.sessionKey!)}/messages`,
          );
          if (!msgRes.ok) return;

          const { messages: openclawMessages } = await msgRes.json() as {
            ok: boolean;
            messages: { externalId: string; role: string; text: string; thinking: string | null; timestamp: string | null }[];
          };

          if (!openclawMessages?.length) return;

          const validMessages = openclawMessages.filter((m) => m.externalId);
          if (!validMessages.length) return;

          // Check which externalIds already exist in ANY conversation — not just this one.
          // OpenClaw shares one JSONL per agent, so the file may contain messages
          // that were already saved under a different conversation for the same agent.
          const globallyExisting = new Set(
            (await Message.find(
              { externalId: { $in: validMessages.map((m) => m.externalId) } },
              { externalId: 1 },
            ).lean()).map((m) => m.externalId),
          );

          const toInsert = validMessages.filter((m) => !globallyExisting.has(m.externalId));
          if (!toInsert.length) return;

          const result = await Message.bulkWrite(
            toInsert.map((m) => ({
              updateOne: {
                filter: { conversationId: conv._id, externalId: m.externalId },
                update: {
                  $setOnInsert: {
                    conversationId: conv._id,
                    externalId: m.externalId,
                    text: m.text,
                    thinking: m.thinking || null,
                    files: [],
                    role: m.role as MessageRole,
                    createdBy: req.user!._id,
                    createdAt: m.timestamp ? new Date(m.timestamp) : new Date(),
                  },
                },
                upsert: true,
              },
            })),
          );
          syncedMessages += result.upsertedCount;
        } catch {
          // skip conversations whose messages can't be fetched
        }
      }),
    );

    return res.json({ syncedAgents, syncedConversations, syncedMessages });
  } catch (error) {
    return next(error);
  }
};

const workspaceMeta: RequestHandler = async (req, res, next) => {
  try {
    const agent = await Agent.findById(req.params.id).lean();
    if (!agent?.openclawAgentId) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    const proxyRes = await fetch(
      `${OPENCLAW_PROXY_URL}/api/agents/${encodeURIComponent(agent.openclawAgentId)}/workspace`,
    );
    const data = await proxyRes.json() as Record<string, unknown>;
    if (!proxyRes.ok) {
      return res.status(proxyRes.status >= 400 ? proxyRes.status : 502).json(data);
    }
    return res.json(data);
  } catch (error) {
    return next(error);
  }
};

const getWorkspaceFile: RequestHandler = async (req, res, next) => {
  try {
    const agent = await Agent.findById(req.params.id).lean();
    if (!agent?.openclawAgentId) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    const { filename } = req.params;
    const proxyRes = await fetch(
      `${OPENCLAW_PROXY_URL}/api/agents/${encodeURIComponent(agent.openclawAgentId)}/workspace/file/${encodeURIComponent(filename)}`,
    );
    const data = await proxyRes.json() as Record<string, unknown>;
    if (!proxyRes.ok) {
      return res.status(proxyRes.status >= 400 ? proxyRes.status : 502).json(data);
    }
    return res.json(data);
  } catch (error) {
    return next(error);
  }
};

const putWorkspaceFile: RequestHandler = async (req, res, next) => {
  try {
    const agent = await Agent.findById(req.params.id).lean();
    if (!agent?.openclawAgentId) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    const { filename } = req.params;
    const { content } = req.body as { content: string };
    const proxyRes = await fetch(
      `${OPENCLAW_PROXY_URL}/api/agents/${encodeURIComponent(agent.openclawAgentId)}/workspace/file/${encodeURIComponent(filename)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      },
    );
    const data = await proxyRes.json() as Record<string, unknown>;
    if (!proxyRes.ok) {
      return res.status(proxyRes.status >= 400 ? proxyRes.status : 502).json(data);
    }
    return res.json(data);
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
};
