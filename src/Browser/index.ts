import { Browser } from './_Browser';

export type IBrowserInfo = {
  browser: string;
  device: 'Mobile' | 'Tablet' | 'PC';
  engine: string;
  language: string;
  os: string;
  osVersion: string;
  version: string;
};

export const DefaultBrowserInfo: IBrowserInfo = new (Browser as any)(navigator.userAgent);
