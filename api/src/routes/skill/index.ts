import Router from 'express';
import controller from './controller';
import auth from '../../middlewares/auth';

const router = Router();

router.route('/skill').get(auth, controller.list);

export default router;
