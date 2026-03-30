import { body } from 'express-validator';
// import axios from 'axios';
import validate from '../../middlewares/validator';

// const reCaptcha = async (value: string, { req: Request }) => {
//   try {
//     if (process.env.NODE_ENV === 'test' || (process.env.NODE_ENV === 'development' && req.body.token === 'test_token_for_swagger')) return true;
//     const res = await axios.post(`https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET}&response=${value}`);
//     if (res.data.success === false) {
//       Promise.reject(new Error('Incorrect credentials'));
//     }
//     return true;
//   } catch (e) {
//     return Promise.reject(new Error('Incorrect credentials'));
//   }
// };

export default {
  login: validate([
    body('email').notEmpty().withMessage('Please enter email address').bail().isEmail().withMessage('Please enter correct email address'),
    body('password').notEmpty().withMessage('Please enter your password'),
    // body('token').notEmpty().withMessage('token is required').bail().custom(reCaptcha),
  ]),
};
