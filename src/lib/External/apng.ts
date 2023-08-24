import { loadScript } from '../loadScript';
import type * as _t from 'apng-js';
import type { APNG } from 'apng-js';

export type { APNG, Frame } from 'apng-js';
export type Player = Awaited<ReturnType<APNG['getPlayer']>>;

export const getApngJs = async () => {
  await loadScript('https://rshop.tech/gw/assets/npm/apng-js@1.1.1/index.min.js');
  return (window as any)['apng-js'] as typeof _t;
};
