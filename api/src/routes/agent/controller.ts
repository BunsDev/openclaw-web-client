import { Types } from 'mongoose';
import Agent from '../../models/agent';
import Conversation from '../../models/conversation';
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

export {
  list,
  get,
  create,
  update,
  destroy,
};
