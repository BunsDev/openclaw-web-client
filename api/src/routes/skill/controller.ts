import { List } from '../../@types/skill';
import * as ocService from '../../services/openclaw';

// eslint-disable-next-line import/prefer-default-export
export const list: List = async (_req, res, next) => {
  try {
    return res.json(ocService.listSkills());
  } catch (error) {
    return next(error);
  }
};
