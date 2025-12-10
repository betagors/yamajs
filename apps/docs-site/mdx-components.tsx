import type { MDXComponents } from 'mdx/types';
import { Cards, Card } from './app/components/Cards';

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    Cards,
    Card,
    ...components,
  }
}
