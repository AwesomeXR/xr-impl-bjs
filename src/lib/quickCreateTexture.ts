import { Texture } from '@babylonjs/core/Materials/Textures';
import { IFlowHost } from 'ah-flow-node';

export function quickCreateTexture(host: IFlowHost, url: string, ext?: string) {
  return new Texture(
    url,
    host,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    ext
  );
}
