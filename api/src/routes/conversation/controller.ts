import Conversation from '../../models/conversation';
import Message from '../../models/message';
import { ListByAgent, Create, Update, Destroy } from '../../@types/conversation';

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
    return res.json(conversation);
  } catch (error) {
    return next(error);
  }
};

const destroy: Destroy = async (req, res, next) => {
  try {
    await Conversation.findByIdAndUpdate(req.params.id, { deletedAt: new Date() });
    await Message.updateMany({ conversationId: req.params.id }, { deletedAt: new Date() });
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
