import React, { useCallback, useEffect, useRef } from 'react';
import { Padding } from '@extensions/AttributePanel/components/attributes/Padding';
import {
  ColorPickerField,
  ImageUploaderField,
  SwitchField,
  TextField,
} from '@extensions/components/Form';
import { Width } from '@extensions/AttributePanel/components/attributes/Width';
import { Height } from '@extensions/AttributePanel/components/attributes/Height';
import { Link } from '@extensions/AttributePanel/components/attributes/Link';
import { Align } from '@extensions/AttributePanel/components/attributes/Align';

import { AttributesPanelWrapper } from '@extensions/AttributePanel/components/attributes/AttributesPanelWrapper';
import { Button, Collapse, Grid, Space, Tooltip } from '@arco-design/web-react';
import { IconRefresh } from '@arco-design/web-react/icon';
import { Border } from '@extensions/AttributePanel/components/attributes/Border';
import { Stack, useEditorProps, useFocusIdx } from 'easy-email-editor';
import { CollapseWrapper } from '../../attributes/CollapseWrapper';
import { imageHeightAdapter, pixelAdapter } from '../../adapter';
import { useField, useForm } from 'react-final-form';
import { get } from 'lodash';

const fullWidthOnMobileAdapter = {
  format(obj: any) {
    return Boolean(obj);
  },
  parse(val: string) {
    if (!val) return undefined;

    return 'true';
  },
};

export function Image() {
  const { focusIdx } = useFocusIdx();
  const { onUploadImage } = useEditorProps();
  const form = useForm();
  const { input: { value: src } } = useField(`${focusIdx}.attributes.src`, { subscription: { value: true } });

  const prevFocusIdxRef = useRef(focusIdx);
  const prevSrcRef = useRef('');

  const applyIntrinsicDimensions = useCallback((url: string) => {
    if (!url) return;
    const img = new window.Image();
    img.onload = () => {
      form.change(`${focusIdx}.attributes.width`, `${img.naturalWidth}px`);
      // Keep height auto so the aspect ratio is preserved when the
      // container is narrower than the intrinsic width.
      form.change(`${focusIdx}.attributes.height`, 'auto');
    };
    img.src = url;
  }, [form, focusIdx]);

  useEffect(() => {
    // When switching to a different block, sync refs without auto-applying
    if (focusIdx !== prevFocusIdxRef.current) {
      prevFocusIdxRef.current = focusIdx;
      prevSrcRef.current = src;
      return;
    }

    if (src && src !== prevSrcRef.current) {
      const currentWidth = get(form.getState().values, `${focusIdx}.attributes.width`) as string || '';
      if (!currentWidth) {
        applyIntrinsicDimensions(src);
      }
    }
    prevSrcRef.current = src;
  }, [src, focusIdx, applyIntrinsicDimensions, form]);

  return (
    <AttributesPanelWrapper style={{ padding: 0 }}>
      <CollapseWrapper defaultActiveKey={['0', '1', '2', '3', '4']}>
        <Collapse.Item
          name='1'
          header={t('Image')}
        >
          <Stack
            vertical
            spacing='tight'
          >
            <ImageUploaderField
              label={t('src')}
              labelHidden
              name={`${focusIdx}.attributes.src`}
              helpText={t(
                'The image suffix should be .jpg, jpeg, png, gif, etc. Otherwise, the picture may not be displayed normally.',
              )}
              uploadHandler={onUploadImage}
            />
            <ColorPickerField
              label={t('Background color')}
              name={`${focusIdx}.attributes.container-background-color`}
              inline
            />
            <SwitchField
              label={t('Full width on mobile')}
              name={`${focusIdx}.attributes.fluid-on-mobile`}
              config={fullWidthOnMobileAdapter}
            />
          </Stack>
        </Collapse.Item>

        <Collapse.Item
          name='0'
          header={t('Size')}
        >
          <Space direction='vertical'>
            <Grid.Row>
              <Grid.Col span={11}>
                <Width config={pixelAdapter} />
              </Grid.Col>
              <Grid.Col
                offset={1}
                span={11}
              >
                <Height config={imageHeightAdapter} />
              </Grid.Col>
            </Grid.Row>

            <Grid.Row justify='end'>
              <Tooltip content={t('Resize to the image\'s intrinsic dimensions')}>
                <Button
                  size='mini'
                  icon={<IconRefresh />}
                  disabled={!src}
                  onClick={() => applyIntrinsicDimensions(src)}
                >
                  {t('Fit to image')}
                </Button>
              </Tooltip>
            </Grid.Row>

            <Padding showResetAll />
            <Grid.Row>
              <Grid.Col span={24}>
                <Align />
              </Grid.Col>
            </Grid.Row>
          </Space>
        </Collapse.Item>

        <Collapse.Item
          name='2'
          header={t('Link')}
        >
          <Stack
            vertical
            spacing='tight'
          >
            <Link />
          </Stack>
        </Collapse.Item>

        <Collapse.Item
          name='3'
          header={t('Border')}
        >
          <Border />
        </Collapse.Item>

        <Collapse.Item
          name='4'
          header={t('Advanced')}
        >
          <Grid.Row>
            <Grid.Col span={11}>
              <TextField
                label={t('title')}
                name={`${focusIdx}.attributes.title`}
              />
            </Grid.Col>
            <Grid.Col
              offset={1}
              span={11}
            >
              <TextField
                label={t('alt')}
                name={`${focusIdx}.attributes.alt`}
              />
            </Grid.Col>
          </Grid.Row>
          <Grid.Col span={24}>
            <TextField
              label={t('class name')}
              name={`${focusIdx}.attributes.css-class`}
            />
          </Grid.Col>
        </Collapse.Item>
      </CollapseWrapper>
    </AttributesPanelWrapper>
  );
}
