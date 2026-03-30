import Router from 'express';
import * as controller from './controller';
import validate from './validation';
import auth from '../../middlewares/auth';

const router = Router();

router.route('/conversation/agent/:agentId([0-9a-fA-F]{24})')
  .get(
    auth,
    validate.agentId,
    controller.listByAgent,
  );

router.route('/conversation')
  .post(
    auth,
    validate.create,
    controller.create,
  );

router.route('/conversation/:id([0-9a-fA-F]{24})')
  .patch(
    auth,
    validate.update,
    controller.update,
  )
  .delete(
    auth,
    validate.id,
    controller.destroy,
  );

export default router;
