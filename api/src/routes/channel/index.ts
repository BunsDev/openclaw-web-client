import Router from 'express';
import { list, add, remove } from './controller';
import auth from '../../middlewares/auth';

const router = Router();

router.route('/channel')
  .get(auth, list)
  .post(auth, add);

router.route('/channel/:name')
  .delete(auth, remove);

export default router;
