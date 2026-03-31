import { IArticle } from '@demo/services/article';
import { api } from '@demo/utils/api';
import createSliceState from './common/createSliceState';

export default createSliceState({
  name: 'templateList',
  initialState: [] as IArticle[],
  reducers: {
    set: (state, action) => state,
  },
  effects: {
    fetch: async state => {
      const list = await api.getAll();
      list.sort((a, b) => (a.updated_at > b.updated_at ? -1 : 1));
      return list;
    },
  },
});
