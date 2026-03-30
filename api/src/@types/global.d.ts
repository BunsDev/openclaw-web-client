import { IUser } from './user';

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'test' | 'development' | 'production';
      MONGO_LINK: string;
      JWT_SECRET: string;
      ALLOWED_DOMAIN: string;
    }
  }
}

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

export {};
