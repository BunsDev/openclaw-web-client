import Router from 'express';
import * as controller from './controller';
import validate from './validation';
import auth from '../../middlewares/auth';

const router = Router();

router.route('/agent')
  .get(
    auth,
    validate.sanitizeQuery,
    controller.list,
  )
  .post(
    auth,
    validate.create,
    controller.create,
  );

router.route('/agent/sync')
  .post(
    auth,
    controller.sync,
  );

router.route('/agent/:id([0-9a-fA-F]{24})/workspace')
  .get(
    auth,
    validate.id,
    controller.workspaceMeta,
  );

router.route('/agent/:id([0-9a-fA-F]{24})/workspace/file/:filename')
  .get(
    auth,
    validate.workspaceFilename,
    controller.getWorkspaceFile,
  )
  .put(
    auth,
    validate.workspacePut,
    controller.putWorkspaceFile,
  );

router.route('/agent/:id([0-9a-fA-F]{24})')
  .get(
    auth,
    validate.id,
    controller.get,
  )
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
