import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { AssetContainer } from '@babylonjs/core/assetContainer';
import { IAssetContainerInitConfig_TextureModify } from 'xr-core';
import { getBlobUrl } from './getBlobUrl';
import { quickXhrDownload } from './quickXhrDownload';
import { BRCUtil } from '../BRCUtil';
import { IFlowHost } from 'ah-flow-node';

export function updateTexture(
  host: IFlowHost,
  _container: AssetContainer,
  _tex: Texture,
  _texCfg: IAssetContainerInitConfig_TextureModify
) {
  const _callMap: Record<keyof IAssetContainerInitConfig_TextureModify, Function> = {
    url: function () {
      if (typeof _texCfg.url !== 'undefined') {
        getBlobUrl(host.mfs, _texCfg.url).then(({ url, ext }) => {
          quickXhrDownload<ArrayBuffer>(url, 'arraybuffer').then(data => {
            BRCUtil.quickUpdateTextureData(_texCfg.url!, _tex, data, ext, () =>
              host.event.emit('__afterTextureUpdated', { texture: _tex })
            );
          });
        });
      }
    },
    uvScale: function () {
      if (typeof _texCfg.uvScale !== 'undefined') {
        _tex.uScale = _texCfg.uvScale[0];
        _tex.vScale = _texCfg.uvScale[1];
      }
    },
    uvOffset: function () {
      if (typeof _texCfg.uvOffset !== 'undefined') {
        _tex.uOffset = _texCfg.uvOffset[0];
        _tex.vOffset = _texCfg.uvOffset[1];
      }
    },
    level: function () {
      if (typeof _texCfg.level !== 'undefined') _tex.level = _texCfg.level;
    },
    uvSet: function () {
      if (typeof _texCfg.uvSet !== 'undefined') _tex.coordinatesIndex = _texCfg.uvSet;
    },
  };

  Object.keys(_callMap).forEach(k => (_callMap as any)[k]());
}
