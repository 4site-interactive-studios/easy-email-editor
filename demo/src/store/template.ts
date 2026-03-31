import { IArticle } from '@demo/services/article';
import createSliceState from './common/createSliceState';
import { Message } from '@arco-design/web-react';
import { history } from '@demo/utils/history';
import { IBlockData, BlockManager, BasicType, AdvancedType } from 'easy-email-core';
import { IEmailTemplate } from 'easy-email-editor';
import { getTemplate } from '@demo/config/getTemplate';
import { localStorageTemplates } from '@demo/utils/local-storage-templates';
import { nowUnix } from '@demo/utils/time';

export function getAdaptor(data: IArticle): IEmailTemplate {
  const content = JSON.parse(data.content.content) as IBlockData;
  return {
    ...data,
    content,
    subject: data.title,
    subTitle: data.summary,
  };
}

export default createSliceState({
  name: 'template',
  initialState: null as IEmailTemplate | null,
  reducers: {
    set: (state, action) => {
      return action.payload;
    },
  },
  effects: {
    fetchById: async (
      state,
      { id }: { id: number; userId?: number },
    ) => {
      try {
        let data = await getTemplate(id);
        if (!data) {
          data = localStorageTemplates.getById(id);
        }
        if (!data) {
          throw new Error('Template not found');
        }
        return getAdaptor(data);
      } catch (error) {
        history.replace('/');
        throw error;
      }
    },
    fetchDefaultTemplate: async state => {
      return {
        subject: 'Welcome to Easy-email',
        subTitle: 'Nice to meet you!',
        content: BlockManager.getBlockByType(BasicType.PAGE).create({
          children: [BlockManager.getBlockByType(AdvancedType.WRAPPER).create()],
        }),
      } as IEmailTemplate;
    },
    create: async (
      state,
      payload: {
        template: IEmailTemplate;
        name: string;
        picture?: string;
        success: (id: number, data: IEmailTemplate) => void;
      },
    ) => {
      const id = localStorageTemplates.generateId();
      const now = nowUnix();
      const articleData: IArticle = {
        article_id: id,
        title: payload.name,
        summary: payload.template.subTitle || '',
        picture: payload.picture || '',
        content: {
          article_id: id,
          content: JSON.stringify(payload.template.content),
        },
        user_id: 0,
        category_id: 0,
        tags: [],
        secret: 0,
        readcount: 0,
        level: 0,
        created_at: now,
        updated_at: now,
      };
      localStorageTemplates.save(articleData);
      const adapted = getAdaptor(articleData);
      payload.success(id, adapted);
      return adapted;
    },
    duplicate: async (
      state,
      payload: {
        article: { article_id: number; user_id: number };
        success: (id: number) => void;
      },
    ) => {
      let source = await getTemplate(payload.article.article_id);
      if (!source) {
        source = localStorageTemplates.getById(payload.article.article_id);
      }
      if (!source) {
        throw new Error('Template not found');
      }
      const id = localStorageTemplates.generateId();
      const now = nowUnix();
      const copy: IArticle = {
        article_id: id,
        title: source.title + ' (copy)',
        summary: source.summary || '',
        picture: source.picture || '',
        content: {
          article_id: id,
          content: typeof source.content === 'string'
            ? source.content
            : source.content.content,
        },
        user_id: 0,
        category_id: 0,
        tags: [],
        secret: 0,
        readcount: 0,
        level: 0,
        created_at: now,
        updated_at: now,
      };
      localStorageTemplates.save(copy);
      payload.success(id);
    },
    updateById: async (
      state,
      payload: {
        id: number;
        template: IEmailTemplate;
        picture?: string;
        success: (templateId: number) => void;
      },
    ) => {
      const isDefault = await getTemplate(payload.id);
      if (isDefault) {
        Message.error('Cannot change the default template');
        return;
      }

      const existing = localStorageTemplates.getById(payload.id);
      if (!existing) {
        Message.error('Template not found');
        return;
      }

      const updated: IArticle = {
        ...existing,
        title: payload.template.subject || existing.title,
        summary: payload.template.subTitle || existing.summary,
        picture: payload.picture || existing.picture,
        content: {
          article_id: payload.id,
          content: JSON.stringify(payload.template.content),
        },
        updated_at: nowUnix(),
      };
      localStorageTemplates.save(updated);
      payload.success(payload.id);
    },
    removeById: async (state, payload: { id: number; success: () => void }) => {
      localStorageTemplates.remove(payload.id);
      payload.success();
      Message.success('Removed successfully.');
    },
  },
});
