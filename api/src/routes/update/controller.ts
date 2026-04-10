import { RequestHandler } from 'express';
import * as updateService from '../../services/updateService';

export const status: RequestHandler = async (_req, res, next) => {
  try {
    const result = updateService.getUpdateStatus();
    return res.json(result);
  } catch (error) {
    return next(error);
  }
};

export const check: RequestHandler = async (_req, res, next) => {
  try {
    const result = await updateService.checkForUpdate();
    return res.json(result);
  } catch (error) {
    return next(error);
  }
};

export const apply: RequestHandler = async (_req, res, next) => {
  try {
    if (updateService.isUpdating()) {
      return res.status(409).json({ ok: false, error: 'Update already in progress' });
    }
    const result = await updateService.applyUpdate();
    if (!result.ok) {
      return res.status(500).json(result);
    }
    return res.json(result);
  } catch (error) {
    return next(error);
  }
};
