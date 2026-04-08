import { RequestHandler } from 'express';
import { QueryFilters, RequestParams, APIResponse } from './shared';

export type IUser = {
  _id: number;
  name: string;
  lastName: string;
  password: string;
  email: string;
  phone: string | null;
  active: boolean;
  createdAt: Date | string;
  updatedAt: Date | string | null;
  deletedAt?: Date | string | null;
};

export type UserRequestBody = {
  email: string;
  password: string;
  token: string;
};

export type CUser = Omit<IUser, 'password' | 'deletedAt'>;

export type GetCurentUser = RequestHandler<never, CUser, never, never>;
export type Login = RequestHandler<never, CUser, UserRequestBody, never>;
export type Logout = RequestHandler<never, never, never, never>;

export type UserFilters = QueryFilters<'name' | 'email' | 'createdAt' | 'updatedAt'>;

export type CreateUserBody = {
  name: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
};

export type UpdateUserBody = {
  name?: string;
  lastName?: string;
  email?: string;
  password?: string;
  phone?: string;
  active?: boolean;
};

export type List = RequestHandler<never, APIResponse<CUser>, never, UserFilters>;
export type Get = RequestHandler<RequestParams, CUser | null, never, never>;
export type Create = RequestHandler<never, CUser, CreateUserBody, never>;
export type Update = RequestHandler<RequestParams, CUser | null, UpdateUserBody, never>;
export type Destroy = RequestHandler<RequestParams, null, never, never>;
