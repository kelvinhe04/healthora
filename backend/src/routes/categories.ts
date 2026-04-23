import Elysia from 'elysia';
import { Category } from '../db/models/Category';

export const categoriesRouter = new Elysia({ prefix: '/categories' })
  .get('/', () => Category.find().lean());
