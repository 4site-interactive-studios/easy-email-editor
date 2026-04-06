import { BlockManager, IPage, BasicType, IBlockData } from 'easy-email-core';
import { identity, isString, pickBy } from 'lodash';
import { parseXMLtoBlock } from './parseXMLtoBlock';

// Attributes that are illegal on <mj-raw> — strip during import
export const RAW_ILLEGAL_ATTRS = new Set([
  'padding', 'border', 'direction', 'text-align',
  'background-repeat', 'background-size', 'background-position',
  'vertical-align', 'align', 'background-color',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
]);

/**
 * Parse MJML JSON AST (from mjml-browser) into block data.
 * @param skipDefaults - If true, don't merge editor defaults via block.create().
 *   Use this for Code→Visual when the user edited MJML to avoid injecting
 *   unwanted default attributes that override the <mj-attributes> cascade.
 */
export function MjmlToJson(data: MjmlBlockItem | string, skipDefaults = false): IPage {
  if (isString(data)) return parseXMLtoBlock(data);

  const transform = (item: IChildrenItem): IBlockData => {
    const attributes = item.attributes as any;

    switch (item.tagName) {
      case 'mjml':
        const body = item.children?.find((item) => item.tagName === 'mj-body')!;
        const head = item.children?.find((item) => item.tagName === 'mj-head');
        const metaData = getMetaDataFromMjml(head);

        const fonts =
          head?.children
            ?.filter((child) => child.tagName === 'mj-font')
            .map((child) => ({
              name: child.attributes.name,
              href: child.attributes.href,
            })) || [];

        const mjAttributes =
          head?.children?.find((item) => item.tagName === 'mj-attributes')
            ?.children || [];

        const headStyles = head?.children
          ?.filter((item) => item.tagName === 'mj-style')
          .map((item) => ({ content: item.content, inline: item.inline }));

        // Extract mj-title and mj-preview
        const titleNode = head?.children?.find((item) => item.tagName === 'mj-title');
        const previewNode = head?.children?.find((item) => item.tagName === 'mj-preview');

        // Preserve ALL mj-attributes as headAttributes string.
        // Filter out:
        // 1. mj-raw nodes (comments inside mj-attributes from mjml-browser parser)
        // 2. Easy-email metadata attributes (only if metaData actually has values)
        const headAttributes = [
          ...new Set(
            mjAttributes
              .filter((item) => {
                // Skip mj-raw (comments converted by mjml-browser)
                if (item.tagName === 'mj-raw') return false;

                // Only filter metadata matches when metaData actually has values
                // (prevents undefined === undefined from removing unrelated entries)
                if (metaData['font-family']) {
                  const isFontFamily =
                    item.tagName === 'mj-all' &&
                    item.attributes['font-family'] === metaData['font-family'];
                  if (isFontFamily) return false;
                }
                if (metaData['text-color']) {
                  const isTextColor =
                    item.tagName === 'mj-text' &&
                    item.attributes['color'] === metaData['text-color'];
                  if (isTextColor) return false;
                }
                if (metaData['content-background-color']) {
                  const isContentColor =
                    ['mj-wrapper', 'mj-section'].includes(item.tagName) &&
                    item.attributes['background-color'] ===
                    metaData['content-background-color'];
                  if (isContentColor) return false;
                }
                return true;
              })
              .map(
                (item) =>
                  `<${item.tagName} ${Object.keys(item.attributes)
                    .map((key) => `${key}="${item.attributes[key]}"`)
                    .join(' ')} />`
              )
          ),
        ].join('\n');

        const breakpoint = head?.children?.find(
          (item) => item.tagName === 'mj-breakpoint'
        );

        // Extract extra head content (mj-raw blocks inside mj-head)
        const extraHeadContent = head?.children
          ?.filter((item) => item.tagName === 'mj-raw')
          .map((item) => item.content || '')
          .filter(Boolean)
          .join('\n') || '';

        // Build extra head tags (mj-title, mj-preview) to preserve
        let extraHeadTags = '';
        if (titleNode) {
          extraHeadTags += `<mj-title>${titleNode.content || ''}</mj-title>\n`;
        }
        if (previewNode) {
          extraHeadTags += `<mj-preview>${previewNode.content || ''}</mj-preview>\n`;
        }

        const pagePayload = {
          attributes: body.attributes || {},
          children: body.children?.map(transform) || [],
          data: {
            value: {
              headAttributes: headAttributes,
              headStyles: headStyles || [],
              fonts: fonts,
              breakpoint: breakpoint?.attributes.width || '',
              responsive: true,
              extraHeadContent: (extraHeadTags + (extraHeadContent || '')).trim() || undefined,
              ...metaData,
            },
          },
        };

        if (skipDefaults) {
          // Import fidelity: construct Page directly without defaults
          return { type: BasicType.PAGE, ...pagePayload } as IPage;
        }
        // Editor round-trip: use Page.create() to merge defaults
        return BlockManager.getBlockByType<IPage>(BasicType.PAGE)!.create(pagePayload);

      default:
        const tag = item.tagName.replace('mj-', '').toLowerCase();

        const block = BlockManager.getBlockByType(tag as any);
        if (!block) {
          throw new Error(`${tag} block no found `);
        }

        // Build attributes — only what the source MJML provided
        let blockAttributes = { ...attributes };

        // Strip illegal attributes from mj-raw blocks
        if (block.type === BasicType.RAW) {
          Object.keys(blockAttributes).forEach(key => {
            if (RAW_ILLEGAL_ATTRS.has(key)) {
              delete blockAttributes[key];
            }
          });
        }

        const payload: IBlockData<any> = {
          type: block.type,
          attributes: blockAttributes,
          data: {
            value: {},
          },
          children: [],
        };

        if (item.content) {
          payload.data.value.content = item.content;
        }

        if (block.type === BasicType.CAROUSEL) {
          payload.data.value.images =
            item.children?.map((child) => {
              return child.attributes;
            }) || [];
          payload.children = [];
        } else if (block.type === BasicType.NAVBAR) {
          payload.data.value.links =
            item.children?.map((child) => {
              const navbarLinkData = {
                ...child.attributes,
                content: child.content,
              };
              formatPadding(navbarLinkData, 'padding');
              return navbarLinkData;
            }) || [];
          payload.children = [];
        } else if (block.type === BasicType.SOCIAL) {
          payload.data.value.elements =
            item.children?.map((child) => {
              return {
                ...child.attributes,
                content: child.content,
              };
            }) || [];
          payload.children = [];
        } else if (item.children) {
          payload.children = item.children.map(transform);
        }

        if (skipDefaults) {
          return payload as IBlockData;
        }
        const blockData = block.create(payload);
        formatPadding(blockData.attributes, 'padding');
        formatPadding(blockData.attributes, 'inner-padding');
        return blockData;
    }
  };

  return transform(data);
}

export function getMetaDataFromMjml(data?: IChildrenItem): {
  [key: string]: any;
} {
  const mjmlHtmlAttributes = data?.children
    ?.filter((item) => item.tagName === 'mj-html-attributes')
    .map((item) => item.children)
    .flat()
    .filter((item) => item && item.attributes.class === 'easy-email')
    .reduce((obj: { [key: string]: any; }, item) => {
      if (!item) return obj;
      const name = item.attributes['attribute-name'];
      const isMultipleAttributes = Boolean(
        item.attributes['multiple-attributes']
      );
      obj[name] = isMultipleAttributes
        ? pickBy(
          {
            ...item.attributes,
            'attribute-name': undefined,
            'multiple-attributes': undefined,
            class: undefined,
          },
          identity
        )
        : item.attributes[name];
      return obj;
    }, {});

  return pickBy(mjmlHtmlAttributes, identity);
}

function formatPadding(
  attributes: IBlockData['attributes'],
  attributeName: 'padding' | 'inner-padding'
) {
  const ele = document.createElement('div');
  Object.keys(attributes).forEach((key: string) => {
    if (new RegExp(`^${attributeName}`).test(key)) {
      const formatKey = new RegExp(`^${attributeName}(.*)`).exec(key)?.[0];
      if (formatKey) {
        ele.style[formatKey as any] = attributes[key];
        delete attributes[key];
      }
    }
  });
  const newPadding = [
    ele.style.paddingTop,
    ele.style.paddingRight,
    ele.style.paddingBottom,
    ele.style.paddingLeft,
  ]
    .filter(Boolean)
    .join(' ');

  if (newPadding) {
    attributes[attributeName] = newPadding;
  }
}

