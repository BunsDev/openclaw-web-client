import jwt from 'jsonwebtoken';
import { RequestHandler } from 'express';
import createError from 'http-errors';
import User from '../models/user';
import BlackList from '../models/blacklist';
import { JwtPayload } from '../@types/blacklist';

const auth: RequestHandler = async (req, res, next) => {
  try {
    const { authorization = '' } = req.headers;
    const token = authorization.replace('Bearer ', '');

    const { id, valid } = jwt.verify(token, process.env.JWT_SECRET) as JwtPayload;
    if (!id || !valid) return next(createError(401));

    const isBlackLised = await BlackList.findOne({ userId: id, hash: valid }).lean();
    if (isBlackLised) return next(createError(401));

    const user = await User.findOne({ _id: id, active: true }).lean();
    if (!user) return next(createError(401));

    req.user = user;

    return next();
  } catch (e) {
    return next(createError(401));
  }
};

export default auth;
