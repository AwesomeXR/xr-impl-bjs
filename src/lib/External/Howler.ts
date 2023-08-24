import { loadScript } from '../loadScript';
import type { Howl } from 'howler';

export type * from 'howler';

export const getHowler = async () => {
  await loadScript('https://rshop.tech/gw/assets/npm/howler@2.2.3/howler.min.js');
  return (window as any).Howl as typeof Howl;
};
