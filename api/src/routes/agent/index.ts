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

router.route('/agent/:id(\\d+)/workspace')
  .get(
    auth,
    validate.id,
    controller.workspaceMeta,
  );

router.route('/agent/:id(\\d+)/workspace/file/:filename')
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

router.route('/agent/:id(\\d+)/workspace/uploads/:filename')
  .get(
    controller.serveWorkspaceUpload,
  );

router.route('/agent/:id(\\d+)/conversation/:conversationId(\\d+)/session-settings')
  .get(
    auth,
    controller.getSessionSettings,
  )
  .patch(
    auth,
    controller.patchSessionSettings,
  );

router.route('/agent/:id(\\d+)')
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
