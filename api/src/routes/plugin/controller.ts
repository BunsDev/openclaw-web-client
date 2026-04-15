import { RequestHandler } from 'express';
import * as ocService from '../../services/openclawService';

const list: RequestHandler = async (_req, res, next) => {
  try {
    return res.json(ocService.listPlugins());
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
    const result = ocService.togglePlugin(id, enable);
    if (!result.ok) {
      return res.status(500).json(result);
    }
    return res.json(result);
  } catch (error) {
    return next(error);
  }
};

export { list, toggle };
