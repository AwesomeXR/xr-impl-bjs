import { FlowNodeTypeRegistry, IFlowNodeTypeRegisterData } from 'ah-flow-node';
import { Tools } from '@babylonjs/core/Misc/tools';
import { CubeTexture } from '@babylonjs/core/Materials/Textures/cubeTexture';
import { BaseTexture } from '@babylonjs/core/Materials/Textures/baseTexture';
import { getExt } from '../lib';

export const getHDRNodeRegisterData = (): IFlowNodeTypeRegisterData<'HDRNode'> => ({
  ...FlowNodeTypeRegistry.Default.get('HDRNode')!,
  setup(ctx) {
    let lastSceneEnvTexture: BaseTexture | null;
    let lastSceneEnvIntensity: number;
    let envTex: CubeTexture;

    lastSceneEnvTexture = ctx.host.environmentTexture;
    lastSceneEnvIntensity = ctx.host.environmentIntensity;

    envTex = CubeTexture.CreateFromPrefilteredData('', ctx.host);
    ctx.host.environmentTexture = envTex;

    const updateEnvTextUrl = () => {
      if (!ctx.input.url) return;

      const queryingUrl = ctx.input.url;

      const httpURLPromise = ctx.input.url.startsWith('file://')
        ? ctx.host.mfs.readFile(ctx.input.url).then(data => URL.createObjectURL(new Blob([data])))
        : Promise.resolve(ctx.input.url);

      httpURLPromise.then(url => {
        if (!envTex || ctx.disposed || queryingUrl !== ctx.input.url) return;

        const forcedExtension = getExt(queryingUrl);
        envTex.updateURL(url, forcedExtension);
      });
    };

    updateEnvTextUrl();

    if (typeof ctx.input.rotationY === 'number') envTex.rotationY = Tools.ToRadians(ctx.input.rotationY);
    if (typeof ctx.input.intensity === 'number') ctx.host.environmentIntensity = ctx.input.intensity;

    ctx.event.listen('input:change:rotationY', () => {
      if (typeof ctx.input.rotationY === 'number') envTex.rotationY = Tools.ToRadians(ctx.input.rotationY);
    });

    ctx.event.listen('input:change:intensity', () => {
      if (typeof ctx.input.intensity === 'number') ctx.host.environmentIntensity = ctx.input.intensity;
    });

    ctx.event.listen('input:change:url', () => {
      updateEnvTextUrl();
    });

    return () => {
      ctx.host.environmentTexture = lastSceneEnvTexture;

      if (typeof lastSceneEnvIntensity === 'number') {
        ctx.host.environmentIntensity = lastSceneEnvIntensity;
      }

      envTex.dispose();
    };
  },
});
