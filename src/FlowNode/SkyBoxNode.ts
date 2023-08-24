import { FlowNodeTypeRegistry, IFlowNodeTypeRegisterData, Util } from 'ah-flow-node';
import { Tools } from '@babylonjs/core/Misc/tools';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { BackgroundMaterial } from '@babylonjs/core/Materials/Background/backgroundMaterial';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders';
import { getExt } from '../lib';

export const getSkyBoxNodeRegisterData = (): IFlowNodeTypeRegisterData<'SkyBoxNode'> => ({
  ...FlowNodeTypeRegistry.Default.get('SkyBoxNode')!,
  setup(ctx) {
    // SkyBoxTexture
    const skyBoxTex = new Texture(null, ctx.host);
    skyBoxTex.coordinatesMode = Texture.EXPLICIT_MODE;
    skyBoxTex.name = ctx.name + '_' + 'skyBoxTex';

    // skyBoxMat
    const skyBoxMat = new BackgroundMaterial(ctx.name + '_' + 'skyBoxMat', ctx.host);
    skyBoxMat.diffuseTexture = skyBoxTex;
    skyBoxMat.useRGBColor = false;
    skyBoxMat.enableNoise = true;
    skyBoxMat.opacityFresnel = false;

    // skyBoxMesh
    const skyBoxMesh = CreateSphere(
      ctx.name + '_' + 'skyBoxMesh',
      { diameter: 9999, sideOrientation: Mesh.BACKSIDE },
      ctx.host
    );
    skyBoxMesh.material = skyBoxMat;
    skyBoxMesh.isPickable = false;
    skyBoxMesh.infiniteDistance = true;
    (skyBoxMesh as any).disableFrustumCheck = true;

    ctx.output.meshes = { mesh: skyBoxMesh };

    const flusher = Util.createNodeFlusher(ctx, {
      url: function () {
        if (!ctx.input.url) return;

        const ctxUrlSnap = ctx.input.url;

        const urlPromise = ctxUrlSnap.startsWith('file://')
          ? ctx.host.mfs.readFile(ctxUrlSnap).then(dat => URL.createObjectURL(new Blob([dat])))
          : Promise.resolve(ctxUrlSnap);

        const forcedExtension = getExt(ctxUrlSnap);

        urlPromise.then(_url => {
          if (ctx.disposed || ctx.input.url !== ctxUrlSnap) return;

          skyBoxTex.updateURL(_url, undefined, undefined, forcedExtension);
        });
      },
      rotationY: function () {
        if (typeof ctx.input.rotationY === 'number') skyBoxMesh.rotation.y = Tools.ToRadians(ctx.input.rotationY);
      },
      flipY: function () {
        skyBoxMesh.scaling.y = ctx.input.flipY ? -1 : 1;
      },
      _meta: function () {},
    });

    flusher.bindInputEvent();

    flusher.handler.url();
    flusher.handler.rotationY();
    flusher.handler.flipY();

    return () => {
      skyBoxTex.dispose();
      skyBoxMat.dispose(true, true);
      skyBoxMesh.dispose(false, true);
    };
  },
});
