import { IconFont, BlockAvatarWrapper } from 'easy-email-editor';
import { getIconNameByBlockType } from '@extensions';
import React from 'react';
import { BlockManager, IBlockData, RecursivePartial } from 'easy-email-core';
import { iconLabelStyle, iconWrapperStyle } from './styles';

export interface DragIconProps<T extends IBlockData> {
  type: string;
  payload?: RecursivePartial<T>;
  color: string;
}

export function DragIcon<T extends IBlockData = any>(props: DragIconProps<T>) {
  const block = BlockManager.getBlockByType(props.type);
  return (
    <BlockAvatarWrapper type={props.type} payload={props.payload}>
      <div title={block?.name} style={{ ...iconWrapperStyle, cursor: 'move' }}>
        <IconFont
          iconName={getIconNameByBlockType(props.type)}
          style={{ fontSize: 20, textAlign: 'center', color: props.color }}
        />
        <span style={iconLabelStyle}>{block?.name}</span>
      </div>
    </BlockAvatarWrapper>
  );
}
