import Router from 'express';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import * as controller from './controller';
import validate from './validation';
import auth from '../../middlewares/auth';

const router = Router();

const uploadsDir = path.join(__dirname, '../../public/uploads');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${crypto.randomBytes(16).toString('hex')}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 },
});

router
  .route('/message/conversation/:conversationId(\\d+)')
  .get(auth, validate.conversationId, controller.listByConversation);

router.route('/message').post(auth, validate.create, controller.create);

router.route('/message/chat').post(auth, upload.array('files', 5), validate.chat, controller.chat);

router.route('/message/:id(\\d+)').delete(auth, validate.id, controller.destroy);

export default router;
