import { Types } from 'mongoose';
import User from '../../models/user';
import { List, Get, Create, Update, Destroy } from '../../@types/user';

const list: List = async (req, res, next) => {
  try {
    const { page = 0, limit = 40, sortField = 'createdAt', sortType = 'desc' } = req.query;
    const query = User.find().select('-password');

    if (req.query.search) {
      const regexp = new RegExp(`.*${req.query.search}.*`, 'i');
      if (Types.ObjectId.isValid(req.query.search as string)) {
        query.where({ _id: req.query.search });
      } else {
        query.or([{ name: regexp }, { lastName: regexp }, { email: regexp }]);
      }
    }

    const total = await query.clone().skip(0).countDocuments();
    const items = await query
      .skip(Number(page) * Number(limit))
      .limit(Number(limit))
      .collation({ locale: 'en' })
      .sort({ [sortField as string]: sortType })
      .lean()
      .exec();

    return res.json({ total, items });
  } catch (error) {
    return next(error);
  }
};

const get: Get = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password').lean();
    return res.json(user);
  } catch (error) {
    return next(error);
  }
};

const create: Create = async (req, res, next) => {
  try {
    const user = new User({
      ...req.body,
      createdAt: new Date(),
    });
    const saved = await user.save();
    const { password, ...userWithoutPassword } = saved.toObject();
    return res.json(userWithoutPassword);
  } catch (error) {
    return next(error);
  }
};

const update: Update = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true },
    ).select('-password').lean();
    return res.json(user);
  } catch (error) {
    return next(error);
  }
};

const destroy: Destroy = async (req, res, next) => {
  try {
    if (req.params.id === String(req.user!._id)) {
      return res.status(400).json({ error: 'You cannot delete your own account' } as any);
    }
    await User.findByIdAndUpdate(req.params.id, { deletedAt: new Date() });
    return res.json(null);
  } catch (error) {
    return next(error);
  }
};

export {
  list,
  get,
  create,
  update,
  destroy,
};
