import fs from 'fs';
import path from 'path';
import Message from '../../models/message';
import Conversation from '../../models/conversation';
import Agent from '../../models/agent';
import { ListByConversation, Create, Chat, Destroy, MessageFile } from '../../@types/message';

const OPENCLAW_PROXY_URL = process.env.OPENCLAW_PROXY_URL || 'http://localhost:18801';

function stripWrapperTags(text: string): string {
  const TAG = 'final|output|think|thinking|redacted_thinking';
  return text
    .replace(new RegExp(`^<(?:${TAG})\\b[^>]*>`, 'i'), '')
    .replace(new RegExp(`</(?:${TAG})\\s*>\\s*$`, 'i'), '')
    .replace(/<\/[a-z]*\s*$/i, '')
    .trim();
}

const uploadsDir = path.join(__dirname, '../../public/uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const DEFAULT_PAGE_SIZE = 50;

const listByConversation: ListByConversation = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const limit = Math.min(Math.max(parseInt(req.query.limit || '', 10) || DEFAULT_PAGE_SIZE, 1), 200);
    const { before } = req.query;

    const filter: Record<string, unknown> = { conversationId };
    if (before) {
      filter.createdAt = { $lt: new Date(before) };
    }

    const items = await Message.find(filter)
      .sort({ createdAt: 'desc' })
      .limit(limit + 1)
      .lean();

    const hasMore = items.length > limit;
    if (hasMore) items.pop();

    items.reverse();

    return res.json({ total: items.length, items, hasMore });
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
    const agentIdForFiles = agent?.openclawAgentId || 'main';

    const files: MessageFile[] = uploadedFiles.map((f) => ({
      filename: f.originalname,
      originalName: f.originalname,
      mimetype: f.mimetype,
      size: f.size,
      url: `${OPENCLAW_PROXY_URL}/api/agents/${encodeURIComponent(agentIdForFiles)}/workspace/uploads/${encodeURIComponent(f.originalname)}`,
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

    const isFirstMessage = !conv.title && !!text;
    if (isFirstMessage) {
      await Conversation.findByIdAndUpdate(conversationId, { title: text.slice(0, 200) });
    }

    const formData = new FormData();
    if (text) formData.append('message', text);
    formData.append('sessionKey', conv.sessionKey || String(conv._id));
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
    let lineBuf = '';

    const processLine = (line: string) => {
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
    };

    const parseChunk = (chunk: string) => {
      lineBuf += chunk;
      const parts = lineBuf.split('\n');
      lineBuf = parts.pop()!;
      parts.forEach(processLine);
    };

    const pump = (): Promise<void> => reader.read().then(({ done, value }) => {
      if (done) {
        if (lineBuf.trim()) processLine(lineBuf);
        return undefined;
      }
      const chunk = decoder.decode(value, { stream: true });
      res.write(chunk);
      parseChunk(chunk);
      return pump();
    });

    await pump();

    const agentIdForProxy = agent?.openclawAgentId || 'main';
    const convKey = conv.sessionKey || String(conv._id);

    if (!conv.sessionKey) {
      await Conversation.findByIdAndUpdate(conversationId, { sessionKey: convKey });
    }

    if (isFirstMessage) {
      fetch(`${OPENCLAW_PROXY_URL}/api/agents/${encodeURIComponent(agentIdForProxy)}/sessions/${encodeURIComponent(convKey)}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: text!.slice(0, 200) }),
      }).catch(() => {});
    }

    const assistantText = stripWrapperTags(fullText).trim();
    const assistantThinking = fullThinking ? stripWrapperTags(fullThinking).trim() : '';

    let assistantMsgId: string | null = null;

    if (assistantText || assistantThinking) {
      try {
        const assistantMessage = new Message({
          conversationId,
          text: assistantText || '...',
          thinking: assistantThinking || null,
          role: 'assistant',
          createdBy: req.user!._id,
          createdAt: new Date(),
        });
        const saved = await assistantMessage.save();
        assistantMsgId = String(saved._id);
      } catch (saveErr) {
        console.error('[chat] failed to save assistant message:', saveErr);
      }
    } else {
      console.warn('[chat] stream ended with empty text/thinking, assistant message not saved');
    }

    try {
      const msgRes = await fetch(
        `${OPENCLAW_PROXY_URL}/api/agents/${encodeURIComponent(agentIdForProxy)}/sessions/${encodeURIComponent(convKey)}/messages`,
      );
      if (msgRes.ok) {
        const { messages: jsonlMessages } = await msgRes.json() as {
          ok: boolean;
          messages: { externalId: string; role: string; text: string }[];
        };
        if (jsonlMessages?.length) {
          const lastUserJsonl = [...jsonlMessages].reverse().find((m) => m.role === 'user');
          const lastAssistantJsonl = [...jsonlMessages].reverse().find((m) => m.role === 'assistant');

          if (lastUserJsonl?.externalId) {
            await Message.findByIdAndUpdate(userMessage._id, { externalId: lastUserJsonl.externalId });
          }
          if (lastAssistantJsonl?.externalId && assistantMsgId) {
            await Message.findByIdAndUpdate(assistantMsgId, { externalId: lastAssistantJsonl.externalId });
          }
        }
      }
    } catch {
      // Non-critical — sync will still work, just can't deduplicate this pair
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
    const msg = await Message.findById(req.params.id).lean();
    await Message.findByIdAndUpdate(req.params.id, { deletedAt: new Date() });

    if (msg?.externalId && msg.conversationId) {
      const conv = await Conversation.findById(msg.conversationId).lean();
      if (conv?.sessionKey) {
        const agent = await Agent.findById(conv.agentId).lean();
        if (agent?.openclawAgentId) {
          const delUrl = `${OPENCLAW_PROXY_URL}/api/agents/${encodeURIComponent(agent.openclawAgentId)}`
            + `/sessions/${encodeURIComponent(conv.sessionKey)}`
            + `/messages/${encodeURIComponent(msg.externalId)}`;
          fetch(delUrl, { method: 'DELETE' }).catch(() => {});
        }
      }
    }

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
