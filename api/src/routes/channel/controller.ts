import { RequestHandler } from 'express';
import * as ocService from '../../services/openclawService';

const list: RequestHandler = async (_req, res, next) => {
  try {
    return res.json(ocService.listChannels());
  } catch (error) {
    return next(error);
  }
};

const add: RequestHandler = async (req, res, next) => {
  try {
    const { channel, ...opts } = req.body as { channel: string; [key: string]: string };
    if (!channel) {
      return res.status(400).json({ error: 'channel is required' });
    }
    const result = ocService.addChannel(channel, opts);
    if (!result.ok) {
      return res.status(500).json(result);
    }
    return res.json(result);
  } catch (error) {
    return next(error);
  }
};

const remove: RequestHandler = async (req, res, next) => {
  try {
    const { name } = req.params;
    const { account } = req.query as { account?: string };
    const result = ocService.removeChannel(name, account);
    if (!result.ok) {
      return res.status(500).json(result);
    }
    return res.json(result);
  } catch (error) {
    return next(error);
  }
};

export { list, add, remove };
