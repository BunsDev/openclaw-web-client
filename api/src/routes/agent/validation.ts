import { body, param } from 'express-validator';
import { List } from '../../@types/agent';
import validate from '../../middlewares/validator';

export default {
  sanitizeQuery: ((req, res, next) => {
    req.query.page = req.query.page as number >= 0 ? req.query.page : 0;
    req.query.limit = [5, 10, 20, 40, 60, 100].includes(+(req.query.limit as number)) ? req.query.limit : 40;
    req.query.sortType = ['asc', 'desc'].includes(req.query.sortType as string) ? req.query.sortType : 'desc';
    req.query.sortField = ['name', 'createdAt', 'updatedAt'].includes(req.query.sortField as string) ? req.query.sortField : 'createdAt';
    return next();
  }) as List,

  id: validate([
    param('id').isMongoId().withMessage('Incorrect request url'),
  ]),

  create: validate([
    body('name').notEmpty().withMessage('Please enter the agent name')
      .isLength({ min: 1, max: 100 }).withMessage('Agent name must contain between 1 and 100 characters'),
  ]),

  update: validate([
    param('id').isMongoId().withMessage('Incorrect request url'),
    body('name').notEmpty().withMessage('Please enter the agent name')
      .isLength({ min: 1, max: 100 }).withMessage('Agent name must contain between 1 and 100 characters'),
  ]),
};
