import React, { useCallback, useMemo, useRef } from 'react';
import { useLocalStorage } from 'react-use';
import { debounce } from 'lodash';
import { useBlock, useRefState } from 'easy-email-editor';
import { extractColorsFromTemplate } from '@extensions/utils/extractColorsFromTemplate';

const defaultPresetColor: string[] = [
  '#000000',
  '#FFFFFF',
  '#9b9b9b',
  '#d0021b',
  '#4a90e2',
  '#7ed321',
  '#bd10e0',
  '#f8e71c',
];

const CURRENT_COLORS_KEY = 'CURRENT_COLORS_KEY';
const MAX_RECORD_SIZE = 20;

export const PresetColorsContext = React.createContext<{
  colors: string[];
  templateColors: string[];
  addCurrentColor: (color: string) => void;
}>({
  colors: [],
  templateColors: [],
  addCurrentColor: () => {},
});

export const PresetColorsProvider: React.FC<{
  children: React.ReactNode | React.ReactElement;
}> = props => {
  const [currentColors, setCurrentColors] = useLocalStorage<string[]>(
    CURRENT_COLORS_KEY,
    defaultPresetColor,
  );
  const currentColorsRef = useRefState(currentColors);

  const colorDivRef = useRef(document.createElement('div'));

  // Extract colors from the current template
  const { values } = useBlock();
  const templateColors = useMemo(() => {
    if (!values?.content) return [];
    return extractColorsFromTemplate(values.content);
  }, [values?.content]);

  const addCurrentColor = useCallback(
    debounce((newColor: string) => {
      colorDivRef.current.style.color = '';
      colorDivRef.current.style.color = newColor;
      if (colorDivRef.current.style.color) {
        if (currentColorsRef.current!.includes(newColor)) return;
        const newColors = [...new Set([...currentColorsRef.current!, newColor])]
          .filter(Boolean)
          .slice(-MAX_RECORD_SIZE);

        setCurrentColors(newColors);
      }
    }, 500),
    [currentColorsRef, setCurrentColors],
  );

  const value = useMemo(() => {
    return {
      colors: currentColors!,
      templateColors,
      addCurrentColor,
    };
  }, [addCurrentColor, currentColors, templateColors]);

  return useMemo(() => {
    return (
      <PresetColorsContext.Provider value={value}>
        {props.children}
      </PresetColorsContext.Provider>
    );
  }, [props.children, value]);
};
