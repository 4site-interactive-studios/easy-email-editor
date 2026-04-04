import React from 'react';
import { IBlockData } from '@core/typings';
import { BasicType } from '@core/constants';
import { createBlock } from '@core/utils/createBlock';
import { Wrapper } from '../Wrapper';
import { merge } from 'lodash';

import { generaMjmlMetaData } from '@core/utils/generaMjmlMetaData';
import { BlockRenderer } from '@core/components/BlockRenderer';
import { getAdapterAttributesString, getChildIdx, getPageIdx } from '@core/utils';
import { t } from '@core/utils/I18nManager';

export type IPage = IBlockData<
  {
    'background-color'?: string;
    width: string;
  },
  {
    breakpoint?: string;
    headAttributes: string;
    fonts?: { name: string; href: string }[];
    headStyles?: {
      content?: string;
      inline?: 'inline';
    }[];
    extraHeadContent?: string;
    responsive?: boolean;
    'font-family'?: string;
    'font-size'?: string;
    'font-weight'?: string;
    'line-height'?: string;
    'text-color'?: string;
    'user-style'?: {
      content?: string;
      inline?: 'inline';
    };
    'content-background-color'?: string;
    /** Attributes on the root <mjml> element (e.g., lang="en") */
    mjmlAttributes?: string;
  }
>;

export const Page = createBlock<IPage>({
  get name() {
    return t('Page');
  },
  type: BasicType.PAGE,
  create: payload => {
    const defaultData: IPage = {
      type: BasicType.PAGE,
      data: {
        value: {
          breakpoint: '480px',
          headAttributes: '',
          'font-size': '14px',
          'font-weight': '400',
          'line-height': '1.7',
          headStyles: [],
          fonts: [],
          responsive: true,
          'font-family':
            '-apple-system, BlinkMacSystemFont, \'Segoe UI\', \'Roboto\', \'Oxygen\', \'Ubuntu\', \'Cantarell\', \'Fira Sans\', \'Droid Sans\',\'Helvetica Neue\', sans-serif',
          'text-color': '#000000',
        },
      },
      attributes: {
        'background-color': '#efeeea',
        width: '600px',
      },
      children: [Wrapper.create()],
    };
    return merge(defaultData, payload);
  },
  validParentType: [],
  render(params) {
    const { data } = params;
    const metaData = generaMjmlMetaData(data);
    const value = data.data.value;

    const breakpoint = value.breakpoint
      ? `<mj-breakpoint width="${data.data.value.breakpoint}" />`
      : '';

    const nonResponsive = !value.responsive
      ? `<mj-raw>
            <meta name="viewport" />
           </mj-raw>
           <mj-style inline="inline">.mjml-body { width: ${
             data.attributes.width || '600px'
           }; margin: 0px auto; }</mj-style>`
      : '';
    const styles =
      value.headStyles
        ?.map(
          style =>
            `<mj-style ${style.inline ? 'inline="inline"' : ''}>${
              style.content
            }</mj-style>`,
        )
        .join('\n') || '';

    const userStyle = value['user-style']
      ? `<mj-style ${value['user-style'].inline ? 'inline="inline"' : ''}>${
          value['user-style'].content
        }</mj-style>`
      : '';

    // Extra head content may include mj-title, mj-preview, and mj-raw blocks.
    // mj-title and mj-preview are emitted as-is (not wrapped in mj-raw).
    // Everything else is wrapped in mj-raw.
    let extraHeadContent = '';
    if (value.extraHeadContent) {
      const raw = value.extraHeadContent;
      // Extract mj-title and mj-preview tags to emit directly
      const titleMatch = raw.match(/<mj-title>[\s\S]*?<\/mj-title>/i);
      const previewMatch = raw.match(/<mj-preview>[\s\S]*?<\/mj-preview>/i);
      if (titleMatch) extraHeadContent += titleMatch[0] + '\n';
      if (previewMatch) extraHeadContent += previewMatch[0] + '\n';
      // The rest goes inside mj-raw (meta tags, MSO conditionals, etc.)
      let remaining = raw;
      if (titleMatch) remaining = remaining.replace(titleMatch[0], '');
      if (previewMatch) remaining = remaining.replace(previewMatch[0], '');
      remaining = remaining.trim();
      if (remaining) extraHeadContent += `<mj-raw>${remaining}</mj-raw>`;
    }

    return (
      <>
        {`
          <mjml${value.mjmlAttributes ? ' ' + value.mjmlAttributes : ''}>
          <mj-head>
              ${metaData}
              ${nonResponsive}
              ${styles}
              ${userStyle}
              ${breakpoint}
              ${extraHeadContent}
              ${value.fonts
                ?.filter(Boolean)
                .map(item => `<mj-font name="${item.name}" href="${(item.href || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;')}" />`)}
            <mj-attributes>
              ${
                value['font-family']
                  ? `<mj-all font-family="${value['font-family'].replace(/"/g, '&quot;')}" />`
                  : ''
              }
              ${value['font-size'] ? `<mj-text font-size="${value['font-size']}" />` : ''}
              ${value['text-color'] ? `<mj-text color="${value['text-color']}" />` : ''}
              ${value['line-height'] ? `<mj-text line-height="${value['line-height']}" />` : ''}
              ${value['font-weight'] ? `<mj-text font-weight="${value['font-weight']}" />` : ''}
              ${
                value['content-background-color']
                  ? `<mj-wrapper background-color="${value['content-background-color']}" />
             <mj-section background-color="${value['content-background-color']}" />
            `
                  : ''
              }
              ${value.headAttributes}
            </mj-attributes>
          </mj-head>
          <mj-body ${getAdapterAttributesString(params)}>`}

        {data.children.map((child, index) => (
          <BlockRenderer
            {...params}
            idx={getChildIdx(getPageIdx(), index)}
            key={index}
            data={child}
          />
        ))}

        {'</mj-body></mjml>'}
      </>
    );
  },
});
