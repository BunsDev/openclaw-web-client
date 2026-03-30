import { body, param } from 'express-validator';
import validate from '../../middlewares/validator';

export default {
  conversationId: validate([
    param('conversationId').isMongoId().withMessage('Incorrect conversation id'),
  ]),

  id: validate([
    param('id').isMongoId().withMessage('Incorrect request url'),
  ]),

  create: validate([
    body('conversationId').isMongoId().withMessage('Please provide a valid conversation id'),
    body('text').notEmpty().withMessage('Please enter a message'),
  ]),

  chat: validate([
    body('conversationId').isMongoId().withMessage('Please provide a valid conversation id'),
    body('text').custom((value, { req }) => {
      if (!value && (!req.files || (req.files as Express.Multer.File[]).length === 0)) {
        throw new Error('Please enter a message or attach a file');
      }
      return true;
    }),
  ]),
};
