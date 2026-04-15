import Router from 'express';
import * as controller from './controller';
import auth from '../../middlewares/auth';

const router = Router();

router.route('/plugin').get(auth, controller.list);

router.route('/plugin/:id').post(auth, controller.toggle);

export default router;
