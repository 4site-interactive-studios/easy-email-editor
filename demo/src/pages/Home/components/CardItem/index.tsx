import { IArticle } from '@demo/services/article';
import React, { useCallback, useEffect, useState } from 'react';
import { Pencil, Trash2, Copy } from 'lucide-react';
import { timeAgo } from '@demo/utils/time';
import { useHistory } from 'react-router-dom';
import template from '@demo/store/template';
import { useDispatch } from 'react-redux';
import templateList from '@demo/store/templateList';
import { revisionStore } from '@demo/utils/revisions';
import { getLoadingByKey, useLoading } from '@demo/hooks/useLoading';
import { Loading } from '@demo/components/loading';

const PLACEHOLDER_COLORS = [
  '#4F7CBA', '#E07B54', '#59A96A', '#A855F7',
  '#F59E0B', '#EF4444', '#06B6D4', '#84CC16',
];

function placeholderColor(name: string): string {
  return PLACEHOLDER_COLORS[(name.charCodeAt(0) || 0) % PLACEHOLDER_COLORS.length];
}


interface CardItemProps {
  data: IArticle;
  isBuiltIn?: boolean;
}

export function CardItem({ data, isBuiltIn }: CardItemProps) {
  const dispatch = useDispatch();
  const history = useHistory();
  const [confirming, setConfirming] = useState(false);

  const loading = useLoading([
    getLoadingByKey(template.loadings.duplicate, data.article_id),
    getLoadingByKey(template.loadings.removeById, data.article_id),
  ]);

  // Auto-cancel delete confirmation after 3 seconds
  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 3000);
    return () => clearTimeout(t);
  }, [confirming]);

  const onDelete = useCallback(() => {
    dispatch(
      template.actions.removeById({
        id: data.article_id,
        _actionKey: data.article_id,
        success() {
          revisionStore.clear(data.article_id);
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
    <div className='w-[220px] rounded-lg bg-white shadow-sm overflow-hidden flex flex-col transition-all hover:shadow-md hover:-translate-y-0.5 border border-gray-100'>
      {/* Thumbnail */}
      <div className='h-[150px] overflow-hidden bg-gray-100 shrink-0'>
        {hasThumbnail ? (
          <img
            src={data.picture}
            alt={data.title}
            className='w-full h-full object-cover object-top block'
          />
        ) : (
          <div
            className='w-full h-full flex items-center justify-center'
            style={{ background: bg }}
          >
            <span className='text-6xl font-bold text-white/85 leading-none select-none'>
              {initial}
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className='px-3.5 pt-3 pb-2 flex-1 min-w-0'>
        <div
          className='font-semibold text-sm text-gray-900 truncate leading-snug'
          title={data.title}
        >
          {data.title}
        </div>
        <div className='text-xs text-gray-400 mt-0.5'>
          {isBuiltIn ? 'Template' : `Edited ${timeAgo(timestamp)}`}
        </div>
      </div>

      {/* Actions */}
      <div className='px-3.5 pb-3 pt-2 flex items-center gap-1 border-t border-gray-100'>
        {loading ? (
          <Loading loading color='#666' />
        ) : confirming ? (
          <>
            <span className='text-xs text-red-600 font-medium mr-auto'>Delete?</span>
            <button
              className='px-2 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 transition-colors'
              onClick={onDelete}
            >
              Yes
            </button>
            <button
              className='px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors'
              onClick={() => setConfirming(false)}
            >
              No
            </button>
          </>
        ) : (
          <>
            <button
              className='inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors'
              onClick={onEdit}
            >
              <Pencil size={12} />
              {isBuiltIn ? 'Open' : 'Edit'}
            </button>
            <button
              className='p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100 transition-colors'
              title='Duplicate'
              onClick={onDuplicate}
            >
              <Copy size={14} />
            </button>
            {!isBuiltIn && (
              <button
                className='p-1 text-gray-400 hover:text-red-500 rounded hover:bg-red-50 transition-colors'
                title='Delete'
                onClick={() => setConfirming(true)}
              >
                <Trash2 size={14} />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
