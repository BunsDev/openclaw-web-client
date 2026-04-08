import jwt from 'jsonwebtoken';
import { RequestHandler } from 'express';
import createError from 'http-errors';
import { AppDataSource } from '../data-source';
import { User, BlackList } from '../entities';
import { JwtPayload } from '../@types/blacklist';

const auth: RequestHandler = async (req, res, next) => {
  try {
    const { authorization = '' } = req.headers;
    const token = authorization.replace('Bearer ', '');

    const { id, valid } = jwt.verify(token, process.env.JWT_SECRET) as JwtPayload;
    if (!id || !valid) return next(createError(401));

    const numericId = Number(id);
    const blacklistRepo = AppDataSource.getRepository(BlackList);
    const isBlackListed = await blacklistRepo.findOneBy({ userId: numericId, hash: valid });
    if (isBlackListed) return next(createError(401));

    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOneBy({ _id: numericId, active: true });
    if (!user) return next(createError(401));

    req.user = user;

    return next();
  } catch (e) {
    return next(createError(401));
  }
};

export default auth;
