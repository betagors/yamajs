import { useMDXComponents as getThemeComponents } from 'nextra-theme-docs';
import type { MDXComponents } from 'mdx/types';
import { Cards, Card } from './app/components/Cards';

const themeComponents = getThemeComponents();

export function useMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...themeComponents,
    Cards,
    Card,
    ...components,
  } as MDXComponents;
}

