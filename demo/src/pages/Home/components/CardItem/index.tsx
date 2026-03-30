import { IArticle } from '@demo/services/article';
import React, { useCallback } from 'react';
import { IconEdit, IconDelete, IconCopy } from '@arco-design/web-react/icon';
import dayjs from 'dayjs';
import styles from './index.module.scss';
import { Button, Popconfirm, Space } from '@arco-design/web-react';
import { useHistory } from 'react-router-dom';
import template from '@demo/store/template';
import { useDispatch } from 'react-redux';
import templateList from '@demo/store/templateList';
import { getLoadingByKey, useLoading } from '@demo/hooks/useLoading';
import { Loading } from '@demo/components/loading';

const PLACEHOLDER_COLORS = [
  '#4F7CBA', '#E07B54', '#59A96A', '#A855F7',
  '#F59E0B', '#EF4444', '#06B6D4', '#84CC16',
];

function placeholderColor(name: string): string {
  return PLACEHOLDER_COLORS[(name.charCodeAt(0) || 0) % PLACEHOLDER_COLORS.length];
}

function timeAgo(unix: number): string {
  const seconds = Math.floor(Date.now() / 1000) - unix;
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return dayjs(unix * 1000).format('MMM D, YYYY');
}

interface CardItemProps {
  data: IArticle;
  isBuiltIn?: boolean;
}

export function CardItem({ data, isBuiltIn }: CardItemProps) {
  const dispatch = useDispatch();
  const history = useHistory();

  const loading = useLoading([
    getLoadingByKey(template.loadings.duplicate, data.article_id),
    getLoadingByKey(template.loadings.removeById, data.article_id),
  ]);

  const onDelete = useCallback(() => {
    dispatch(
      template.actions.removeById({
        id: data.article_id,
        _actionKey: data.article_id,
        success() {
          dispatch(templateList.actions.fetch(undefined));
        },
      }),
    );
  }, [data, dispatch]);

  const onDuplicate = useCallback(() => {
    dispatch(
      template.actions.duplicate({
        article: data,
        _actionKey: data.article_id,
        success(id) {
          history.push(`/editor?id=${id}`);
        },
      }),
    );
  }, [data, dispatch, history]);

  const onEdit = useCallback(() => {
    history.push(`/editor?id=${data.article_id}&userId=${data.user_id}`);
  }, [data, history]);

  const hasThumbnail = Boolean(data.picture);
  const initial = (data.title || 'E').charAt(0).toUpperCase();
  const bg = placeholderColor(data.title || '');
  const timestamp = data.updated_at || data.created_at;

  return (
    <div className={styles.card}>
      {/* Thumbnail area */}
      <div className={styles.thumbnail}>
        {hasThumbnail ? (
          <img src={data.picture} alt={data.title} />
        ) : (
          <div className={styles.placeholder} style={{ background: bg }}>
            <span>{initial}</span>
          </div>
        )}
      </div>

      {/* Card body */}
      <div className={styles.body}>
        <div className={styles.name} title={data.title}>
          {data.title}
        </div>
        <div className={styles.meta}>
          {isBuiltIn ? 'Template' : `Edited ${timeAgo(timestamp)}`}
        </div>
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        {loading ? (
          <Loading loading color='#666' />
        ) : (
          <Space size='mini'>
            <Button
              size='small'
              type='primary'
              icon={<IconEdit />}
              onClick={onEdit}
            >
              {isBuiltIn ? 'Open' : 'Edit'}
            </Button>
            <Button
              size='small'
              icon={<IconCopy />}
              title='Duplicate'
              onClick={onDuplicate}
            />
            {!isBuiltIn && (
              <Popconfirm
                title='Delete this email?'
                onConfirm={onDelete}
                okText='Delete'
                okButtonProps={{ status: 'danger' }}
                cancelText='Cancel'
              >
                <Button
                  size='small'
                  status='danger'
                  icon={<IconDelete />}
                  title='Delete'
                />
              </Popconfirm>
            )}
          </Space>
        )}
      </div>
    </div>
  );
}
