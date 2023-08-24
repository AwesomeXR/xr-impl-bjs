import { FlowNodeTypeRegistry, IFlowNodeTypeRegisterData, Util } from 'ah-flow-node';
import { quickXhrDownload } from '../lib';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';

export const getProceduralPBRMaterialNodeRegisterData = (): IFlowNodeTypeRegisterData<'ProceduralPBRMaterialNode'> => ({
  ...FlowNodeTypeRegistry.Default.get('ProceduralPBRMaterialNode')!,
  setup(ctx) {
    let baseColorTexture: Texture | undefined;

    const disposeBaseColorTexture = () => {
      if (baseColorTexture) {
        baseColorTexture.dispose();
        baseColorTexture = undefined;
        ctx.output.baseColorTexture = undefined;
      }
    };

    const flusher = Util.createNodeFlusher(ctx, {
      configKey: function () {
        if (!ctx.input.configKey) return;
        const configKey = ctx.input.configKey;

        let configDataPromise: Promise<any> | undefined;

        if (configKey.startsWith('https://') || configKey.startsWith('blob:')) {
          configDataPromise = quickXhrDownload(configKey, 'json');
        }

        if (!configDataPromise) {
          disposeBaseColorTexture();
          return;
        }

        configDataPromise.then(configData => {
          disposeBaseColorTexture();

          const baseColorTextureURL = configData.baseColorTextureURL;

          if (baseColorTextureURL) {
            baseColorTexture = new Texture(baseColorTextureURL, ctx.host, undefined, true);
            ctx.output.baseColorTexture = baseColorTexture;
          }
        });
      },
      _meta: function () {},
    });

    flusher.bindInputEvent();
    flusher.handler.configKey();

    return () => {
      disposeBaseColorTexture();
    };
  },
});
