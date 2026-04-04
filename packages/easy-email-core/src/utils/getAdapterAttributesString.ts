import { IBlock } from '@core/typings';
import { EMAIL_BLOCK_CLASS_NAME } from '@core/constants';

import { isString } from 'lodash';

import { classnames } from '@core/utils/classnames';
import { getNodeIdxClassName, getNodeTypeClassName } from '@core/utils';
import { encodeXmlAttr } from './xmlEncoding';

export function getAdapterAttributesString(
  params: Parameters<IBlock['render']>[0]
) {
  const { data, idx } = params;
  const isTest = params.mode === 'testing';
  const attributes = { ...data.attributes };
  const keepClassName = isTest ? params.keepClassName : false;

  if (isTest && idx) {
    attributes['css-class'] = classnames(
      attributes['css-class'],
      EMAIL_BLOCK_CLASS_NAME,
      getNodeIdxClassName(idx),
      getNodeTypeClassName(data.type)
    );
  }

  if (keepClassName) {
    attributes['css-class'] = classnames(
      attributes['css-class'],
      getNodeTypeClassName(data.type)
    );
  }

  // Attributes where empty string "" is a valid, intentional value
  // that should be preserved in the output (e.g., alt="" for accessibility)
  const PRESERVE_EMPTY = new Set(['alt', 'href', 'src', 'class', 'css-class', 'title']);

  let attributeStr = '';
  for (let key in attributes) {
    const keyName = key as keyof typeof attributes;
    const val = attributes[keyName];
    if (typeof val === 'boolean') {
      attributeStr += `${key}="${val.toString()}" `;
    } else if (isString(val) && (val || PRESERVE_EMPTY.has(key))) {
      // Properly XML-encode attribute values to handle &, <, >, "
      attributeStr += `${key}="${encodeXmlAttr(val)}" `;
    }
  }

  return attributeStr;
}
