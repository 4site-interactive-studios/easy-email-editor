import { IPage } from '@core/blocks';
import { isObject, isString } from 'lodash';

export function generaMjmlMetaData(data: IPage) {
  const values = data.data.value;
  const attributes = [
    'content-background-color',
    'text-color',
    'font-family',
    'font-size',
    'line-height',
    'font-weight',
    'user-style',
    'responsive',
  ];

  const entries = attributes
    .filter((key) => values[key as keyof typeof values] !== undefined)
    .map((key) => {
      const attKey = key as keyof typeof values;
      const isMultipleAttributes = isObject(values[attKey]);
      const value = isMultipleAttributes
        ? Object.keys(values[attKey]!)
            .map((childKey) => {
              const childValue = (values[attKey] as any)[childKey];

              return `${childKey}="${
                isString(childValue)
                  ? childValue.replace(/"/gm, '&quot;')
                  : childValue
              }"`;
            })
            .join(' ')
        : `${key}="${values[attKey]}"`;
      return `<mj-html-attribute class="easy-email" multiple-attributes="${isMultipleAttributes}" attribute-name="${key}" ${value}></mj-html-attribute>`;
    });

  // Don't emit the wrapper if there are no metadata entries
  // (e.g., for freshly imported MJML that doesn't have editor metadata)
  if (entries.length === 0) return '';

  return `
    <mj-html-attributes>
      ${entries.join('\n')}
    </mj-html-attributes>
  `;
}
