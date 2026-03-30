import fs from 'fs';
import path from 'path';
import Message from '../../models/message';
import Conversation from '../../models/conversation';
import Agent from '../../models/agent';
import { ListByConversation, Create, Chat, Destroy, MessageFile } from '../../@types/message';

const OPENCLAW_PROXY_URL = process.env.OPENCLAW_PROXY_URL || 'http://openclaw:8080';

const uploadsDir = path.join(__dirname, '../../public/uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const listByConversation: ListByConversation = async (req, res, next) => {
  try {
    const items = await Message.find({ conversationId: req.params.conversationId })
      .sort({ createdAt: 'asc' })
      .lean();

    return res.json({ total: items.length, items });
  } catch (error) {
    return next(error);
  }
};

const create: Create = async (req, res, next) => {
  try {
    const message = new Message({ ...req.body, role: 'user', createdBy: req.user!._id, createdAt: new Date() });
    const saved = await message.save();
    return res.json(saved);
  } catch (error) {
    return next(error);
  }
};

const chat: Chat = async (req, res, next) => {
  try {
    const { conversationId, text } = req.body;
    const uploadedFiles = (req.files as Express.Multer.File[]) || [];

    const conv = await Conversation.findById(conversationId).lean();
    if (!conv) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const agent = await Agent.findById(conv.agentId).lean();

    const files: MessageFile[] = uploadedFiles.map((f) => ({
      filename: f.filename,
      originalName: f.originalname,
      mimetype: f.mimetype,
      size: f.size,
      url: `/api/public/uploads/${f.filename}`,
    }));

    const userMessage = new Message({
      conversationId,
      text: text || (files.length ? `[Attached ${files.length} file(s)]` : ''),
      files,
      role: 'user',
      createdBy: req.user!._id,
      createdAt: new Date(),
    });
    await userMessage.save();

    const formData = new FormData();
    if (text) formData.append('message', text);
    formData.append('sessionKey', String(conv.agentId));
    formData.append('openclawAgentId', agent?.openclawAgentId || 'main');

    uploadedFiles.forEach((uf) => {
      const fileBuffer = fs.readFileSync(uf.path);
      const blob = new Blob([fileBuffer], { type: uf.mimetype });
      formData.append('files', blob, uf.originalname);
    });

    const upstream = await fetch(`${OPENCLAW_PROXY_URL}/api/chat/stream`, {
      method: 'POST',
      body: formData,
    });

    if (!upstream.ok || !upstream.body) {
      const errorText = await upstream.text();
      return res.status(upstream.status).json({
        error: 'OpenClaw stream failed',
        details: errorText,
      });
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let fullThinking = '';

    const parseChunk = (chunk: string) => {
      chunk.split('\n').forEach((line) => {
        if (!line.startsWith('data: ')) return;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr || jsonStr === '[DONE]') return;
        try {
          const event = JSON.parse(jsonStr);
          if (event.type === 'response.output_text.delta' && event.delta) {
            fullText += event.delta;
          } else if (event.type === 'response.thinking.delta' && event.delta) {
            fullThinking += event.delta;
          }
        } catch {
          // skip malformed lines
        }
      });
    };

    const pump = (): Promise<void> => reader.read().then(({ done, value }) => {
      if (done) return undefined;
      const chunk = decoder.decode(value, { stream: true });
      res.write(chunk);
      parseChunk(chunk);
      return pump();
    });

    await pump();

    if (fullText || fullThinking) {
      const assistantMessage = new Message({
        conversationId,
        text: fullText || '...',
        thinking: fullThinking || null,
        role: 'assistant',
        createdBy: req.user!._id,
        createdAt: new Date(),
      });
      await assistantMessage.save();
    }

    return res.end();
  } catch (error) {
    if (!res.headersSent) {
      return next(error);
    }
    return res.end();
  }
};

const destroy: Destroy = async (req, res, next) => {
  try {
    await Message.findByIdAndUpdate(req.params.id, { deletedAt: new Date() });
    return res.json(null);
  } catch (error) {
    return next(error);
  }
};

export {
  listByConversation,
  create,
  chat,
  destroy,
};
