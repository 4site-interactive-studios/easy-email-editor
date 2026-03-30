/* eslint-disable react/jsx-wrap-multilines */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import template from '@demo/store/template';
import { useAppSelector } from '@demo/hooks/useAppSelector';
import { useLoading } from '@demo/hooks/useLoading';
import {
  Button,
  ConfigProvider,
  Dropdown,
  Input,
  Menu,
  Message,
  Modal,
  PageHeader,
} from '@arco-design/web-react';
import { IconDownload, IconCopy } from '@arco-design/web-react/icon';
import { useQuery } from '@demo/hooks/useQuery';
import { useHistory } from 'react-router-dom';
import { cloneDeep } from 'lodash';
import { Loading } from '@demo/components/loading';
import { getTemplate } from '@demo/config/getTemplate';

import {
  EmailEditor,
  EmailEditorProvider,
  IEmailTemplate,
} from 'easy-email-editor';

import { AdvancedType, IBlockData, JsonToMjml } from 'easy-email-core';
import { ExtensionProps, SimpleLayout } from 'easy-email-extensions';

import 'easy-email-editor/lib/style.css';
import 'easy-email-extensions/lib/style.css';
import blueTheme from '@arco-themes/react-easy-email-theme/css/arco.css?inline';

import enUS from '@arco-design/web-react/es/locale/en-US';
import { useWindowSize } from 'react-use';

const defaultCategories: ExtensionProps['categories'] = [
  {
    label: 'Content',
    active: true,
    blocks: [
      { type: AdvancedType.TEXT },
      { type: AdvancedType.IMAGE },
      { type: AdvancedType.BUTTON },
      { type: AdvancedType.DIVIDER },
      { type: AdvancedType.SPACER },
      { type: AdvancedType.SOCIAL },
    ],
  },
  {
    label: 'Layout',
    active: true,
    displayType: 'column',
    blocks: [
      {
        title: '2 columns',
        payload: [
          ['50%', '50%'],
          ['33%', '67%'],
          ['67%', '33%'],
          ['25%', '75%'],
          ['75%', '25%'],
        ],
      },
      {
        title: '3 columns',
        payload: [
          ['33.33%', '33.33%', '33.33%'],
          ['25%', '25%', '50%'],
          ['50%', '25%', '25%'],
        ],
      },
      {
        title: '4 columns',
        payload: [['25%', '25%', '25%', '25%']],
      },
    ],
  },
];

export default function Editor() {
  const dispatch = useDispatch();
  const history = useHistory();
  const templateData = useAppSelector('template');
  const { width } = useWindowSize();
  const compact = width > 1280;
  const { id } = useQuery();
  const loading = useLoading(template.loadings.fetchById);

  const [savedArticleId, setSavedArticleId] = useState<number | null>(null);
  const [showNameModal, setShowNameModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [pendingValues, setPendingValues] = useState<IEmailTemplate | null>(null);

  useEffect(() => {
    if (id) {
      dispatch(template.actions.fetchById({ id: +id }));
      getTemplate(+id).then(builtIn => {
        if (!builtIn) {
          setSavedArticleId(+id);
        }
      });
    } else {
      dispatch(template.actions.fetchDefaultTemplate(undefined));
    }

    return () => {
      dispatch(template.actions.set(null));
    };
  }, [dispatch, id]);

  const initialValues: IEmailTemplate | null = useMemo(() => {
    if (!templateData) return null;
    const sourceData = cloneDeep(templateData.content) as IBlockData;
    return {
      ...templateData,
      content: sourceData,
    };
  }, [templateData]);

  const onSubmit = useCallback(
    async (values: IEmailTemplate) => {
      if (savedArticleId) {
        dispatch(
          template.actions.updateById({
            id: savedArticleId,
            template: values,
            success() {
              Message.success('Saved successfully.');
            },
          }),
        );
      } else {
        setPendingValues(values);
        setTemplateName(values.subject || '');
        setShowNameModal(true);
      }
    },
    [dispatch, savedArticleId],
  );

  const handleNameConfirm = useCallback(() => {
    if (!pendingValues || !templateName.trim()) return;

    dispatch(
      template.actions.create({
        template: pendingValues,
        name: templateName.trim(),
        success(newId) {
          setSavedArticleId(newId);
          history.replace(`/editor?id=${newId}`);
          Message.success('Saved successfully.');
        },
      }),
    );
    setShowNameModal(false);
    setPendingValues(null);
  }, [dispatch, history, pendingValues, templateName]);

  const exportHtml = useCallback(async (values: IEmailTemplate) => {
    try {
      const mjml = (await import('mjml-browser')).default;
      const mjmlStr = JsonToMjml({
        data: values.content,
        mode: 'production',
        context: values.content,
      });
      const { html } = mjml(mjmlStr, { validationLevel: 'skip' });
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${values.subject || 'email'}.html`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      Message.error('Export failed. Please try again.');
    }
  }, []);

  const copyHtml = useCallback(async (values: IEmailTemplate) => {
    try {
      const mjml = (await import('mjml-browser')).default;
      const mjmlStr = JsonToMjml({
        data: values.content,
        mode: 'production',
        context: values.content,
      });
      const { html } = mjml(mjmlStr, { validationLevel: 'skip' });
      await navigator.clipboard.writeText(html);
      Message.success('HTML copied to clipboard.');
    } catch (e) {
      Message.error('Copy failed. Please try again.');
    }
  }, []);

  if (!templateData && loading) {
    return (
      <Loading loading={loading}>
        <div style={{ height: '100vh' }} />
      </Loading>
    );
  }

  if (!initialValues) return null;

  return (
    <ConfigProvider locale={enUS}>
      <div>
        <style>{blueTheme}</style>
        <EmailEditorProvider
          height={'calc(100vh - 68px)'}
          data={initialValues}
          onSubmit={onSubmit}
          dashed={false}
          compact={compact}
        >
          {({ values }, helper) => {
            return (
              <>
                <PageHeader
                  style={{ background: 'var(--color-bg-2)', padding: '6px 20px' }}
                  backIcon
                  onBack={() => history.push('/')}
                  title={
                    <Input
                      style={{ width: 260, fontWeight: 600 }}
                      value={values.subject}
                      placeholder='Untitled email'
                      onChange={v => helper.change('subject', v)}
                      onPressEnter={e => (e.target as HTMLInputElement).blur()}
                    />
                  }
                  extra={
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Dropdown
                        droplist={
                          <Menu>
                            <Menu.Item
                              key='download'
                              onClick={() => exportHtml(values)}
                            >
                              <IconDownload style={{ marginRight: 6 }} />
                              Download .html file
                            </Menu.Item>
                            <Menu.Item
                              key='copy'
                              onClick={() => copyHtml(values)}
                            >
                              <IconCopy style={{ marginRight: 6 }} />
                              Copy HTML to clipboard
                            </Menu.Item>
                          </Menu>
                        }
                        position='br'
                      >
                        <Button icon={<IconDownload />}>Export</Button>
                      </Dropdown>
                      <Button type='primary' onClick={() => helper.submit()}>
                        Save
                      </Button>
                    </div>
                  }
                />
                <SimpleLayout showSourceCode={false}>
                  <EmailEditor />
                </SimpleLayout>
              </>
            );
          }}
        </EmailEditorProvider>

        <Modal
          title='Name your email'
          visible={showNameModal}
          onOk={handleNameConfirm}
          onCancel={() => {
            setShowNameModal(false);
            setPendingValues(null);
          }}
          okText='Save'
          okButtonProps={{ disabled: !templateName.trim() }}
        >
          <Input
            placeholder='Enter a name for this email'
            value={templateName}
            onChange={setTemplateName}
            onPressEnter={handleNameConfirm}
            autoFocus
          />
        </Modal>
      </div>
    </ConfigProvider>
  );
}
