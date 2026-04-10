import type { ErrorRequestHandler } from 'express';
import errorStackParser from 'error-stack-parser';

const expressErrorHandler: ErrorRequestHandler = (error, req, res, next) => {
  const { source = '' } = errorStackParser.parse(error)[0] || {};
  res
    .status(error.status || 500)
    .json({ message: process.env.NODE_ENV === 'development' ? `${error.message}. ${source}` : '' });
  return next();
};

export default expressErrorHandler;
