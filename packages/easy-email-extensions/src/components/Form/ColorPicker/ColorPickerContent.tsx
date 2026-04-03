import { Button, Space } from '@arco-design/web-react';
import React, { useContext, useEffect, useMemo, useState } from 'react';

import styles from '../index.module.scss';

import Color from 'color';

import { PresetColorsContext } from '@extensions/AttributePanel/components/provider/PresetColorsProvider';

export interface ColorPickerContentProps {
  onChange: (val: string) => void;
  value: string;
}

const transparentColor = 'rgba(0,0,0,0)';

function ColorSwatch({ color, onClick }: { color: string; onClick: (c: string) => void }) {
  return (
    <div
      title={color}
      onClick={() => onClick(color)}
      style={{
        border: '1px solid var(--color-neutral-3, rgb(229, 230, 235))',
        display: 'inline-block',
        height: 20,
        width: 20,
        boxSizing: 'border-box',
        padding: 4,
        borderRadius: 3,
        backgroundColor: color,
        position: 'relative',
        cursor: 'pointer',
      }}
    />
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10,
      fontWeight: 600,
      color: '#999',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      marginBottom: 4,
    }}>
      {children}
    </div>
  );
}

export function ColorPickerContent(props: ColorPickerContentProps) {
  const { colors: recentColors, templateColors } = useContext(PresetColorsContext);

  const { onChange } = props;
  const [color, setColor] = useState(props.value);

  useEffect(() => {
    setColor(props.value);
  }, [props.value]);

  // Template colors (extracted from MJML, sorted by hue)
  const templateColorList = useMemo(() => {
    return templateColors.filter(item => item !== transparentColor);
  }, [templateColors]);

  // Recent/preset colors (from localStorage)
  const recentColorList = useMemo(() => {
    return [...recentColors.filter(item => item !== transparentColor).slice(-14)];
  }, [recentColors]);

  let adapterColor = color;

  try {
    if (Color(color).hex()) {
      adapterColor = Color(color).hex();
    }
  } catch (error) {}

  return (
    <div
      className={styles.colorPicker}
      style={{ width: 202, paddingTop: 12, paddingBottom: 12 }}
    >
      {/* Template Colors (from the current email) */}
      {templateColorList.length > 0 && (
        <div style={{ padding: '0px 16px', marginBottom: 8 }}>
          <SectionLabel>Template Colors</SectionLabel>
          <Space wrap size='mini'>
            {templateColorList.map(item => (
              <ColorSwatch key={`t-${item}`} color={item} onClick={onChange} />
            ))}
          </Space>
        </div>
      )}

      {/* Recent / Default Colors */}
      <div style={{ padding: '0px 16px' }}>
        {templateColorList.length > 0 && (
          <SectionLabel>Recent</SectionLabel>
        )}
        <Space wrap size='mini'>
          {recentColorList.map(item => (
            <ColorSwatch key={`r-${item}`} color={item} onClick={onChange} />
          ))}
        </Space>
      </div>

      <div
        style={{
          padding: '6px 6px 0px 6px',
        }}
      >
        <Button
          type='text'
          size='small'
          style={{
            color: '#333',
            fontSize: 12,
            width: '100%',
            textAlign: 'left',
            paddingLeft: 10,
            position: 'relative',
          }}
        >
          <span>{t('Picker...')}</span>
          <input
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              zIndex: 1,
              left: 0,
              top: 0,
              opacity: 0,
            }}
            type='color'
            value={adapterColor}
            onChange={e => onChange(e.target.value)}
          />
        </Button>
      </div>
      <style>
        {`
          .form-alpha-picker {
            outline: 1px solid rgb(204, 204, 204, 0.6);
          }
          `}
      </style>
    </div>
  );
}
