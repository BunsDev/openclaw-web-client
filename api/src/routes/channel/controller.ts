import { Add, List, Remove } from '../../@types/channel';
import * as ocService from '../../services/openclaw';

export const list: List = async (_req, res, next) => {
  try {
    return res.json(ocService.listChannels());
  } catch (error) {
    return next(error);
  }
};

export const add: Add = async (req, res, next) => {
  try {
    const { channel, ...opts } = req.body;
    if (!channel) {
      return res.status(400).json({ ok: false, error: 'channel is required' });
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

export const remove: Remove = async (req, res, next) => {
  try {
    const { name } = req.params;
    const { account } = req.query;
    const result = ocService.removeChannel(name, account);
    if (!result.ok) {
      return res.status(500).json(result);
    }
    return res.json(result);
  } catch (error) {
    return next(error);
  }
};
