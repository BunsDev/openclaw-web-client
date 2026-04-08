import AppDataSource from '../../data-source';
import { Agent, Conversation, Message } from '../../entities';
import { ListAll, ListByAgent, Create, Update, Destroy } from '../../@types/conversation';
import * as ocService from '../../services/openclawService';

const listAll: ListAll = async (req, res, next) => {
  try {
    const convRepo = AppDataSource.getRepository(Conversation);
    const items = await convRepo.find({ order: { createdAt: 'DESC' } });
    return res.json({ total: items.length, items });
  } catch (error) {
    return next(error);
  }
};

const listByAgent: ListByAgent = async (req, res, next) => {
  try {
    const convRepo = AppDataSource.getRepository(Conversation);
    const items = await convRepo.find({
      where: { agentId: Number(req.params.agentId) },
      order: { createdAt: 'DESC' },
    });

    return res.json({ total: items.length, items });
  } catch (error) {
    return next(error);
  }
};

const create: Create = async (req, res, next) => {
  try {
    const convRepo = AppDataSource.getRepository(Conversation);
    const conversation = convRepo.create({
      agentId: Number(req.body.agentId),
      createdBy: req.user!._id,
      createdAt: new Date(),
    });
    const saved = await convRepo.save(conversation);
    saved.sessionKey = String(saved._id);
    const updated = await convRepo.save(saved);
    return res.json(updated);
  } catch (error) {
    return next(error);
  }
};

const update: Update = async (req, res, next) => {
  try {
    const convRepo = AppDataSource.getRepository(Conversation);
    const id = Number(req.params.id);

    await convRepo.update(id, { title: req.body.title });
    const conversation = await convRepo.findOneBy({ _id: id });
    if (!conversation) return res.status(404).json(null);

    if (conversation.sessionKey) {
      const agentRepo = AppDataSource.getRepository(Agent);
      const agent = await agentRepo.findOneBy({ _id: conversation.agentId });
      if (agent?.openclawAgentId) {
        ocService.patchSessionSettings(
          agent.openclawAgentId,
          conversation.sessionKey,
          { label: req.body.title || null },
        ).catch(() => {});
      }
    }

    return res.json(conversation);
  } catch (error) {
    return next(error);
  }
};

const destroy: Destroy = async (req, res, next) => {
  try {
    const convRepo = AppDataSource.getRepository(Conversation);
    const msgRepo = AppDataSource.getRepository(Message);
    const id = Number(req.params.id);

    const conv = await convRepo.findOneBy({ _id: id });
    await convRepo.softDelete(id);
    await msgRepo.createQueryBuilder()
      .update(Message)
      .set({ deletedAt: new Date() })
      .where('conversationId = :id', { id })
      .execute();

    if (conv?.sessionKey) {
      const agentRepo = AppDataSource.getRepository(Agent);
      const agent = await agentRepo.findOneBy({ _id: conv.agentId });
      if (agent?.openclawAgentId) {
        ocService.deleteSession(agent.openclawAgentId, conv.sessionKey).catch(() => {});
      }
    }

    return res.json(null);
  } catch (error) {
    return next(error);
  }
};

export {
  listAll,
  listByAgent,
  create,
  update,
  destroy,
};
