import { useAppSelector } from '@demo/hooks/useAppSelector';
import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import Frame from '@demo/components/Frame';
import templateList from '@demo/store/templateList';
import { Button, Divider, Empty, Input } from '@arco-design/web-react';
import { IconPlus, IconSearch } from '@arco-design/web-react/icon';
import { CardItem } from './components/CardItem';
import { history } from '@demo/utils/history';
import templates from '@demo/config/templates.json';

export default function Home() {
  const dispatch = useDispatch();
  const list = useAppSelector('templateList');
  const [search, setSearch] = useState('');

  useEffect(() => {
    dispatch(templateList.actions.fetch(undefined));
  }, [dispatch]);

  const filteredList = search.trim()
    ? list.filter(item =>
        item.title.toLowerCase().includes(search.toLowerCase()),
      )
    : list;

  return (
    <Frame
      title='My Emails'
      primaryAction={
        <Button
          type='primary'
          icon={<IconPlus />}
          onClick={() => history.push('/editor')}
        >
          New Email
        </Button>
      }
    >
      <>
        {/* Search */}
        <Input
          style={{ maxWidth: 320, marginBottom: 20 }}
          prefix={<IconSearch />}
          placeholder='Search emails…'
          value={search}
          onChange={setSearch}
          allowClear
        />

        {/* Saved emails */}
        {filteredList.length === 0 ? (
          <Empty
            style={{ padding: '40px 0 32px' }}
            description={
              search.trim()
                ? `No emails matching "${search}"`
                : 'No emails yet'
            }
          >
            {!search.trim() && (
              <div style={{ marginTop: 8, color: 'var(--color-text-3)', fontSize: 14, marginBottom: 16 }}>
                Start from scratch or pick a template below
              </div>
            )}
            {!search.trim() && (
              <Button
                type='primary'
                icon={<IconPlus />}
                onClick={() => history.push('/editor')}
              >
                New Email
              </Button>
            )}
          </Empty>
        ) : (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 20,
              marginBottom: 8,
            }}
          >
            {filteredList.map(item => (
              <CardItem
                data={item}
                key={item.article_id}
              />
            ))}
          </div>
        )}

        {/* Built-in templates */}
        {templates.length > 0 && (
          <>
            <Divider style={{ margin: '28px 0 20px' }}>
              <span style={{ color: 'var(--color-text-3)', fontSize: 13, fontWeight: 500 }}>
                Start from a template
              </span>
            </Divider>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
              {templates.map(item => (
                <CardItem
                  data={item as any}
                  key={item.article_id}
                  isBuiltIn
                />
              ))}
            </div>
          </>
        )}
      </>
    </Frame>
  );
}
