import Conversation from '../../models/conversation';
import Agent from '../../models/agent';
import Message from '../../models/message';
import { ListByAgent, Create, Update, Destroy } from '../../@types/conversation';

const OPENCLAW_PROXY_URL = process.env.OPENCLAW_PROXY_URL || 'http://localhost:18801';

const listByAgent: ListByAgent = async (req, res, next) => {
  try {
    const items = await Conversation.find({ agentId: req.params.agentId })
      .sort({ createdAt: 'desc' })
      .lean();

    return res.json({ total: items.length, items });
  } catch (error) {
    return next(error);
  }
};

const create: Create = async (req, res, next) => {
  try {
    const conversation = new Conversation({
      agentId: req.body.agentId,
      createdBy: req.user!._id,
      createdAt: new Date(),
    });
    // Set sessionKey to the conversation's own id so the sync can always match it.
    conversation.sessionKey = String(conversation._id);
    const saved = await conversation.save();
    return res.json(saved);
  } catch (error) {
    return next(error);
  }
};

const update: Update = async (req, res, next) => {
  try {
    const conversation = await Conversation.findByIdAndUpdate(
      req.params.id,
      { title: req.body.title },
      { new: true },
    ).lean();
    if (!conversation) return res.status(404).json(null);

    if (conversation.sessionKey) {
      const agent = await Agent.findById(conversation.agentId).lean();
      if (agent?.openclawAgentId) {
        fetch(`${OPENCLAW_PROXY_URL}/api/agents/${encodeURIComponent(agent.openclawAgentId)}/sessions/${encodeURIComponent(conversation.sessionKey)}/settings`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label: req.body.title || null }),
        }).catch(() => {});
      }
    }

    return res.json(conversation);
  } catch (error) {
    return next(error);
  }
};

const destroy: Destroy = async (req, res, next) => {
  try {
    const conv = await Conversation.findById(req.params.id).lean();
    await Conversation.findByIdAndUpdate(req.params.id, { deletedAt: new Date() });
    await Message.updateMany({ conversationId: req.params.id }, { deletedAt: new Date() });

    if (conv?.sessionKey) {
      const agent = await Agent.findById(conv.agentId).lean();
      if (agent?.openclawAgentId) {
        fetch(`${OPENCLAW_PROXY_URL}/api/agents/${encodeURIComponent(agent.openclawAgentId)}/sessions/${encodeURIComponent(conv.sessionKey)}/delete`, {
          method: 'POST',
        }).catch(() => {});
      }
    }

    return res.json(null);
  } catch (error) {
    return next(error);
  }
};

export {
  listByAgent,
  create,
  update,
  destroy,
};
