import { IArticle } from '@demo/services/article';
import { localStorageTemplates } from '@demo/utils/local-storage-templates';
import createSliceState from './common/createSliceState';

export default createSliceState({
  name: 'templateList',
  initialState: [] as IArticle[],
  reducers: {
    set: (state, action) => state,
  },
  effects: {
    fetch: async state => {
      const list = localStorageTemplates.getAll();
      list.sort((a, b) => (a.updated_at > b.updated_at ? -1 : 1));
      return list;
    },
  },
});
