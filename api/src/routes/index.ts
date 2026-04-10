import Router, { Request, Response } from 'express';
import auth from './auth';
import user from './user';
import agent from './agent';
import conversation from './conversation';
import message from './message';
import update from './update';

const router = Router();

router.use(user);
router.use(agent);
router.use(conversation);
router.use(message);
router.use(auth);
router.use(update);

router.use('*', (req: Request, res: Response) => res.status(404).json());

export default router;
