import jwt from 'jsonwebtoken';
import createError from 'http-errors';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import User from '../../models/user';
import BlackList from '../../models/blacklist';
import { Login, Logout, GetCurentUser } from '../../@types/user';
import { JwtPayload } from '../../@types/blacklist';

const getCurrentUser: GetCurentUser = async (req, res, next) => {
  try {
    return res.json(req.user);
  } catch (error) {
    return next(error);
  }
};

const login: Login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase(), active: true }).select('+password').lean();
    if (!user) return next(createError(401));

    const { password: userPassword, ...userData } = user;
    const isSame = await bcrypt.compare(password, userPassword);

    if (isSame) {
      const hash = crypto.createHash('md5').update(`${user._id}-${Math.random()}`).digest('hex');
      const token = jwt.sign({ id: user._id, valid: hash }, process.env.JWT_SECRET);

      return res.header('access-token', token).json(userData);
    }

    return next(createError(401));
  } catch (error) {
    return next(error);
  }
};

const logout: Logout = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')!;
    const { id, valid } = jwt.verify(token, process.env.JWT_SECRET) as JwtPayload;
    await BlackList.create({ userId: id, hash: valid });

    return res.json();
  } catch (error) {
    return next(error);
  }
};

export {
  getCurrentUser,
  login,
  logout,
};
