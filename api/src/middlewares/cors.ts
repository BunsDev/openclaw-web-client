import cors from 'cors';

export default cors({
  exposedHeaders: 'access-token',
  origin: (origin, next) => {
    if (!origin || process.env.NODE_ENV === 'development') return next(null, true);

    const hostname = origin.replace(/^(http(s)?:\/\/)(www.)?/, '').replace(/(\/?(:[0-9]{2,5})?\/?)$/, '');
    const allowedDomains = process.env.ALLOWED_DOMAIN ? process.env.ALLOWED_DOMAIN.split(',').filter((d) => !!d) : [];
    if (allowedDomains.includes(hostname)) return next(null, true);

    return next(new Error('The CORS policy for this site does not allow access from the specified Origin.'), false);
  },
});
