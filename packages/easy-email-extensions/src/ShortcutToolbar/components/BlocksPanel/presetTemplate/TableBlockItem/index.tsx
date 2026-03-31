import React from 'react';
import { Stack } from 'easy-email-editor';
import { AdvancedType } from 'easy-email-core';
import { BlockMaskWrapper } from '@extensions/ShortcutToolbar/components/BlockMaskWrapper';

export function TableBlockItem() {
  return (
    <Stack.Item fill>
      <Stack vertical>
        <BlockMaskWrapper
          type={AdvancedType.TABLE}
          payload={{
            data: {
              value: {
                content:
                  '<tr style="border-bottom:1px solid #e5e7eb">' +
                  '<th style="padding:8px 12px;text-align:left;font-size:13px">Item</th>' +
                  '<th style="padding:8px 12px;text-align:right;font-size:13px">Amount</th>' +
                  '</tr>' +
                  '<tr style="border-bottom:1px solid #f3f4f6">' +
                  '<td style="padding:8px 12px;font-size:13px">Donation</td>' +
                  '<td style="padding:8px 12px;text-align:right;font-size:13px">$50.00</td>' +
                  '</tr>' +
                  '<tr>' +
                  '<td style="padding:8px 12px;font-weight:bold;font-size:13px">Total</td>' +
                  '<td style="padding:8px 12px;text-align:right;font-weight:bold;font-size:13px">$50.00</td>' +
                  '</tr>',
              },
            },
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              padding: 12,
              fontSize: 13,
            }}
          >
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
              }}
            >
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600 }}>
                    Item
                  </th>
                  <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '6px 8px' }}>Donation</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>$50.00</td>
                </tr>
                <tr>
                  <td style={{ padding: '6px 8px', fontWeight: 600 }}>Total</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>
                    $50.00
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </BlockMaskWrapper>
      </Stack>
    </Stack.Item>
  );
}
