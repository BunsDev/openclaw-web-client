import { RequestHandler } from 'express';
import * as ocService from '../../services/openclawService';

const list: RequestHandler = async (_req, res, next) => {
  try {
    return res.json(ocService.listSkills());
  } catch (error) {
    return next(error);
  }
};

export default { list };
