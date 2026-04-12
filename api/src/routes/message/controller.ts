import fs from 'fs';
import path from 'path';
import { LessThan } from 'typeorm';
import AppDataSource from '../../data-source';
import { Message, Conversation, Agent } from '../../entities';
import {
  ListByConversation,
  Create,
  Chat,
  Destroy,
  MessageFile,
  MessageResponse,
} from '../../@types/message';
import * as ocService from '../../services/openclawService';

const API_PUBLIC_URL = process.env.API_PUBLIC_URL || 'http://localhost:18802';

function stripWrapperTags(text: string): string {
  return text
    .replace(/<(?:think|thinking|redacted_thinking)>[\s\S]*?<\/(?:think|thinking|redacted_thinking)>/gi, '')
    .replace(/^<(?:final|output|think|thinking|redacted_thinking)\b[^>]*>/i, '')
    .replace(/<\/(?:final|output|think|thinking|redacted_thinking)\s*>\s*$/i, '')
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
    const limit = Math.min(
      Math.max(parseInt(req.query.limit || '', 10) || DEFAULT_PAGE_SIZE, 1),
      200
    );
    const { before } = req.query;

    const msgRepo = AppDataSource.getRepository(Message);

    const where: Record<string, unknown> = { conversationId: Number(conversationId) };
    if (before) {
      where.createdAt = LessThan(new Date(before));
    }

    const items = await msgRepo.find({
      where: where as any,
      order: { createdAt: 'DESC' },
      take: limit + 1,
    });

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
    const msgRepo = AppDataSource.getRepository(Message);
    const message = msgRepo.create({
      conversationId: Number(req.body.conversationId),
      text: req.body.text || '',
      role: 'user' as const,
      createdBy: req.user!._id,
      createdAt: new Date(),
    });
    const saved = await msgRepo.save(message);
    const result = Object.fromEntries(
      Object.entries(saved as object).filter(([k]) => k !== 'deletedAt')
    ) as MessageResponse;
    return res.json(result);
  } catch (error) {
    return next(error);
  }
};

const chat: Chat = async (req, res, next) => {
  try {
    const { conversationId, text } = req.body;
    const uploadedFiles = (req.files as Express.Multer.File[]) || [];

    const convRepo = AppDataSource.getRepository(Conversation);
    const agentRepo = AppDataSource.getRepository(Agent);
    const msgRepo = AppDataSource.getRepository(Message);

    const conv = await convRepo.findOneBy({ _id: Number(conversationId) });
    if (!conv) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const agent = await agentRepo.findOneBy({ _id: conv.agentId });
    const agentIdForFiles = agent?.openclawAgentId || 'main';

    const filePaths = uploadedFiles.map((uf) =>
      ocService.copyFileToWorkspace(agentIdForFiles, uf.path, uf.originalname)
    );

    const files: MessageFile[] = uploadedFiles.map((f, i) => {
      const savedName = path.basename(filePaths[i]);
      return {
        filename: f.originalname,
        originalName: f.originalname,
        mimetype: f.mimetype,
        size: f.size,
        url: `${API_PUBLIC_URL}/api/agent/${conv.agentId}/workspace/uploads/${encodeURIComponent(savedName)}`,
      };
    });

    const userMessage = msgRepo.create({
      conversationId: Number(conversationId),
      text: text || (files.length ? `[Attached ${files.length} file(s)]` : ''),
      files,
      role: 'user' as const,
      createdBy: req.user!._id,
      createdAt: new Date(),
    });
    const savedUser = await msgRepo.save(userMessage);

    const isFirstMessage = !conv.title && !!text;
    if (isFirstMessage) {
      await convRepo.update(Number(conversationId), { title: text.slice(0, 200) });
    }

    const sessionKey = conv.sessionKey || String(conv._id);

    // Set up SSE headers and stream via the service
    await ocService.runChat(agentIdForFiles, text || '', sessionKey, filePaths, res);

    // runChat will have already ended the response via SSE.
    // Post-stream work: save assistant message and link externalIds.
    // Since runChat uses event listeners and resolves when done,
    // we need a different approach. The SSE is handled by the service
    // and the response is ended there. We handle post-stream in a
    // "response finish" listener.

    // Wait for the response to finish before doing post-stream work
    await new Promise<void>((resolve) => {
      res.on('finish', resolve);
      res.on('close', resolve);
    });

    if (!conv.sessionKey) {
      await convRepo.update(Number(conversationId), { sessionKey });
    }

    if (isFirstMessage) {
      ocService
        .patchSessionSettings(agentIdForFiles, sessionKey, { label: text!.slice(0, 200) })
        .catch(() => {});
    }

    // Fetch messages from JSONL to get externalIds
    try {
      const jsonlMessages = ocService.getSessionMessages(agentIdForFiles, sessionKey);
      if (jsonlMessages.length) {
        const lastUserJsonl = [...jsonlMessages].reverse().find((m) => m.role === 'user');
        const lastAssistantJsonl = [...jsonlMessages].reverse().find((m) => m.role === 'assistant');

        if (lastUserJsonl?.externalId) {
          await msgRepo.update(savedUser._id, { externalId: lastUserJsonl.externalId });
        }

        // Save assistant message from JSONL
        if (lastAssistantJsonl) {
          const assistantText = stripWrapperTags(lastAssistantJsonl.text).trim();
          const assistantThinking = lastAssistantJsonl.thinking
            ? stripWrapperTags(lastAssistantJsonl.thinking).trim()
            : null;

          if (assistantText || assistantThinking) {
            const assistantMessage = msgRepo.create({
              conversationId: Number(conversationId),
              externalId: lastAssistantJsonl.externalId || null,
              text: assistantText || '...',
              thinking: assistantThinking || null,
              role: 'assistant' as const,
              createdBy: req.user!._id,
              createdAt: new Date(),
            });
            await msgRepo.save(assistantMessage);
          }
        }
      }
    } catch {
      // Non-critical
    }
    return undefined;
  } catch (error) {
    if (!res.headersSent) return next(error);
    return undefined;
  }
};

const destroy: Destroy = async (req, res, next) => {
  try {
    const msgRepo = AppDataSource.getRepository(Message);
    const convRepo = AppDataSource.getRepository(Conversation);
    const agentRepo = AppDataSource.getRepository(Agent);
    const id = Number(req.params.id);

    const msg = await msgRepo.findOneBy({ _id: id });
    await msgRepo.softDelete(id);

    if (msg?.externalId && msg.conversationId) {
      const conv = await convRepo.findOneBy({ _id: msg.conversationId });
      if (conv?.sessionKey) {
        const agent = await agentRepo.findOneBy({ _id: conv.agentId });
        if (agent?.openclawAgentId) {
          ocService.deleteSessionMessage(agent.openclawAgentId, conv.sessionKey, msg.externalId);
        }
      }
    }

    return res.json(null);
  } catch (error) {
    return next(error);
  }
};

export { listByConversation, create, chat, destroy };
