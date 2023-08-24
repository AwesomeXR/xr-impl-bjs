import { MemoryFS } from 'ah-memory-fs';
import type { IOfflineProvider } from '@babylonjs/core/Offline';
import { dataUrl2Blob } from './dataUrl2Blob';
import { getBlobUrl } from './getBlobUrl';
import { quickXhrDownload } from './quickXhrDownload';
import { readBlob } from './readBlob';

export class DynamicOfflineProvider implements IOfflineProvider {
  private static _insMap = new Map<string, DynamicOfflineProvider>();

  static setInstance(url: string, mfs: MemoryFS) {
    this._insMap.set(url, new DynamicOfflineProvider(mfs));
  }

  static getInstance(url: string): DynamicOfflineProvider {
    const ins = this._insMap.get(url);
    if (!ins) throw new Error('DynamicOfflineProvider missing instance: ' + url);
    return ins;
  }

  readonly enableSceneOffline = true;
  readonly enableTexturesOffline = true;

  constructor(private mfs: MemoryFS) {}

  open(successCallback: () => void, _errorCallback: () => void): void {
    successCallback();
  }

  loadImage(url: string, img: HTMLImageElement): void {
    // local file
    if (url.startsWith('file://')) {
      const filePath = MemoryFS.normalizePath(url);

      getBlobUrl(this.mfs, filePath).then(rsp => {
        img.src = rsp.url;
        img.addEventListener('load', () => URL.revokeObjectURL(img.src));
      });
    }

    // 其他都当 HTTP 处理
    else {
      img.src = url;
    }
  }

  loadFile(
    url: string,
    sceneLoaded: (data: any) => void,
    progressCallBack?: (data: any) => void,
    errorCallback?: (err: any) => void,
    useArrayBuffer?: boolean
  ): void {
    // local file
    if (url.startsWith('file://')) {
      url = MemoryFS.normalizePath(url);

      this.mfs.stats(url).then(async stats => {
        if (!stats) errorCallback?.(new Error('missing ' + url));

        try {
          const rsp = useArrayBuffer ? await this.mfs.readFile(url) : await this.mfs.readFile(url, 'utf-8');
          sceneLoaded(rsp);
        } catch (err) {
          errorCallback?.(err);
        }
      });
    }

    // base64
    else if (url.startsWith('data:')) {
      const blob = dataUrl2Blob(url);

      readBlob(blob, (useArrayBuffer ? 'ArrayBuffer' : 'Text') as any)
        .then(sceneLoaded)
        .catch(errorCallback);
    }

    // 其他都当 HTTP 处理
    else {
      quickXhrDownload<ArrayBuffer | string>(
        url,
        useArrayBuffer ? 'arraybuffer' : 'text',
        (_pg, ev) => progressCallBack?.(ev)
      )
        .then(sceneLoaded)
        .catch(errorCallback);
    }
  }
}
