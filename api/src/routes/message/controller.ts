import fs from 'fs';
import path from 'path';
import { RequestHandler } from 'express';
import { LessThan, IsNull, MoreThan, FindOptionsWhere } from 'typeorm';
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
import * as ocService from '../../services/openclaw';

const API_PUBLIC_URL = process.env.API_PUBLIC_URL || 'http://localhost:18802';

function stripWrapperTags(text: string): string {
  return text
    .replace(
      /<(?:think|thinking|redacted_thinking)>[\s\S]*?<\/(?:think|thinking|redacted_thinking)>/gi,
      ''
    )
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

    const where: FindOptionsWhere<Message> = { conversationId: Number(conversationId) };
    if (before) {
      where.createdAt = LessThan(new Date(before));
    }

    const items = await msgRepo.find({
      where,
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

    const msgCount = await msgRepo.count({ where: { conversationId: conv._id } });
    if (msgCount === 0) {
      ocService.appendBootstrapImageRule(agentIdForFiles, conv.agentId, API_PUBLIC_URL);
    }

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

const poll: RequestHandler<{ conversationId: string }, unknown, never, { after?: string }> = async (
  req,
  res,
  next
) => {
  try {
    const convId = Number(req.params.conversationId);
    const { after } = req.query;

    const msgRepo = AppDataSource.getRepository(Message);
    const convRepo = AppDataSource.getRepository(Conversation);
    const agentRepo = AppDataSource.getRepository(Agent);

    const conv = await convRepo.findOneBy({ _id: convId });
    if (!conv?.sessionKey) {
      return res.json({ items: [], synced: 0 });
    }

    const agent = await agentRepo.findOneBy({ _id: conv.agentId });
    if (!agent?.openclawAgentId) {
      return res.json({ items: [], synced: 0 });
    }

    let synced = 0;
    const jsonlMessages = ocService
      .getSessionMessages(agent.openclawAgentId, conv.sessionKey)
      .filter((m) => m.externalId);

    if (jsonlMessages.length) {
      const existingIds = new Set(
        (
          await msgRepo.find({
            where: { conversationId: convId },
            select: ['externalId'],
          })
        )
          .map((m) => m.externalId)
          .filter(Boolean)
      );

      const candidates = jsonlMessages.filter((m) => !existingIds.has(m.externalId));

      // Backfill: earlier versions stripped the `[cron:...]` header before
      // storing user messages. Re-apply the full JSONL text for already-linked
      // messages so they render as scheduled-task events in the UI.
      const cronBackfillSource = jsonlMessages.filter(
        (m) => m.role === 'user' && /^\[cron:/i.test(m.text) && existingIds.has(m.externalId)
      );
      if (cronBackfillSource.length) {
        const linkedUserMessages = await msgRepo.find({
          where: { conversationId: convId, role: 'user' },
          select: ['_id', 'externalId', 'text'],
        });
        const byExternalId = new Map(
          linkedUserMessages.filter((m) => m.externalId).map((m) => [m.externalId!, m])
        );
        const textBackfills = cronBackfillSource
          .map((m) => {
            const row = byExternalId.get(m.externalId);
            if (!row || row.text === m.text) return null;
            return { id: row._id, text: m.text };
          })
          .filter((b): b is { id: number; text: string } => b !== null);
        if (textBackfills.length) {
          await Promise.all(textBackfills.map((b) => msgRepo.update(b.id, { text: b.text })));
        }
      }

      // Link any recent unlinked DB messages (saved by the chat handler
      // before their externalId was known) instead of inserting duplicates.
      const recentCutoff = new Date(Date.now() - 120_000);
      const unlinked = await msgRepo.find({
        where: {
          conversationId: convId,
          externalId: IsNull(),
          createdAt: MoreThan(recentCutoff),
        },
        order: { createdAt: 'ASC' },
      });

      const unlinkedByRole = new Map<string, typeof unlinked>();
      unlinked.forEach((u) => {
        const list = unlinkedByRole.get(u.role) || [];
        list.push(u);
        unlinkedByRole.set(u.role, list);
      });

      const toInsert: typeof candidates = [];
      const updates: Array<{ id: number; externalId: string }> = [];

      candidates.forEach((m) => {
        const pool = unlinkedByRole.get(m.role);
        if (pool && pool.length > 0) {
          const match = pool.shift()!;
          updates.push({ id: match._id, externalId: m.externalId! });
        } else {
          toInsert.push(m);
        }
      });

      if (updates.length) {
        await Promise.all(updates.map((u) => msgRepo.update(u.id, { externalId: u.externalId })));
        synced += updates.length;
      }

      if (toInsert.length) {
        await msgRepo.save(
          toInsert.map((m) =>
            msgRepo.create({
              conversationId: convId,
              externalId: m.externalId,
              text: m.text,
              thinking: m.thinking || null,
              files: [],
              role: m.role as 'user' | 'assistant',
              createdBy: req.user!._id,
              createdAt: m.timestamp ? new Date(m.timestamp) : new Date(),
            })
          )
        );
        synced += toInsert.length;
      }
    }

    const where: FindOptionsWhere<Message> = { conversationId: convId };
    if (after) {
      where.createdAt = MoreThan(new Date(after));
    }

    const items = await msgRepo.find({
      where,
      order: { createdAt: 'ASC' },
      take: 200,
    });

    return res.json({ items, synced });
  } catch (error) {
    return next(error);
  }
};

export { listByConversation, create, chat, destroy, poll };
