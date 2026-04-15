import { RequestHandler } from 'express';
import * as ocService from '../../services/openclawService';

const list: RequestHandler = async (_req, res, next) => {
  try {
    return res.json(ocService.listCronJobs());
  } catch (error) {
    return next(error);
  }
};

const add: RequestHandler = async (req, res, next) => {
  try {
    const opts = req.body as Record<string, string>;
    if (!opts.name && !opts.message) {
      return res.status(400).json({ error: 'name or message is required' });
    }
    const result = ocService.addCronJob(opts);
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
    const { id } = req.params;
    const result = ocService.removeCronJob(id);
    if (!result.ok) {
      return res.status(500).json(result);
    }
    return res.json(result);
  } catch (error) {
    return next(error);
  }
};

const toggle: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { enable } = req.body as { enable: boolean };
    if (typeof enable !== 'boolean') {
      return res.status(400).json({ error: 'enable (boolean) is required' });
    }
    const result = ocService.toggleCronJob(id, enable);
    if (!result.ok) {
      return res.status(500).json(result);
    }
    return res.json(result);
  } catch (error) {
    return next(error);
  }
};

export { list, add, remove, toggle };
