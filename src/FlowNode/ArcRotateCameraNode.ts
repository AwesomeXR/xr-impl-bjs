import { FlowNodeTypeRegistry, IFlowNodeTypeRegisterData } from 'ah-flow-node';
import { Scalar } from '@babylonjs/core/Maths/math.scalar';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Tools } from '@babylonjs/core/Misc/tools';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import * as core from 'xr-core';
import { Camera } from '@babylonjs/core/Cameras/camera';
import { BRCUtil } from '../BRCUtil';

export const getArcRotateCameraNodeRegisterData = (): IFlowNodeTypeRegisterData<'ArcRotateCameraNode'> => ({
  ...FlowNodeTypeRegistry.Default.get('ArcRotateCameraNode')!,
  setup(ctx) {
    let obrOB: any;

    const camera = new ArcRotateCamera(
      ctx.name + '_camera',
      Tools.ToRadians(ctx.input.alpha || 0),
      Tools.ToRadians(ctx.input.beta || 45),
      ctx.input.radius || 10,
      ctx.input.target ? new Vector3(ctx.input.target.x, ctx.input.target.y, ctx.input.target.z) : Vector3.Zero(),
      ctx.host,
      true
    );
    camera.allowUpsideDown = false;
    camera.minZ = 0.1;
    camera.useNaturalPinchZoom = true;
    camera.panningInertia = 0;
    camera.wheelDeltaPercentage = 0.1;
    camera.panningSensibility = ctx.input.allowMove ? 1000 : 0;
    camera.mode = ctx.input.isOrthographic ? Camera.ORTHOGRAPHIC_CAMERA : Camera.PERSPECTIVE_CAMERA;

    ctx.output.camera = camera;

    if (!camera.metadata) camera.metadata = {};

    if (typeof ctx.input.fov === 'number') camera.fov = ctx.input.fov;

    if (ctx.input.allowControl) camera.attachControl();
    else camera.detachControl();

    if (ctx.input._meta) {
      if (ctx.input._meta.__fixProjection) {
        camera.metadata.__fixProjection = ctx.input._meta.__fixProjection;
      }
    }

    obrOB = ctx.host.onBeforeRenderObservable.add(() => {
      if (ctx.input.allowMove) camera.panningSensibility = Math.min(500, 1000 / camera.radius); // 相机平移动态灵敏度

      if (camera.mode === Camera.ORTHOGRAPHIC_CAMERA) {
        const arg = BRCUtil.calcArcRotateCameraOrthoArg(ctx.host, camera.viewport, camera);
        Object.assign(camera, arg);
      }

      const glPos = camera.globalPosition;

      // 好像没有好的时机捕获 position 变化，只能每帧脏检查
      if (
        !ctx.output.position ||
        !Scalar.WithinEpsilon(glPos.x, ctx.output.position.x) ||
        !Scalar.WithinEpsilon(glPos.y, ctx.output.position.y) ||
        !Scalar.WithinEpsilon(glPos.z, ctx.output.position.z)
      ) {
        ctx.output.position = core.Vector3.FromArray(glPos.asArray());
      }

      // write back
      const alphaDeg = Tools.ToDegrees(camera.alpha);
      const betaDeg = Tools.ToDegrees(camera.beta);

      if (!Scalar.WithinEpsilon(alphaDeg, ctx.input.alpha || 0)) ctx.input.alpha = alphaDeg;
      if (!Scalar.WithinEpsilon(betaDeg, ctx.input.beta || 0)) ctx.input.beta = betaDeg;
      if (!Scalar.WithinEpsilon(camera.radius, ctx.input.radius || 0)) ctx.input.radius = camera.radius;
      if (!Scalar.WithinEpsilon(camera.fov, ctx.input.fov || 0)) ctx.input.fov = camera.fov;
    });

    function notice() {
      ctx.host.event.emit('__afterCameraNodeChange', { node: ctx as any, _bubble: true });
    }

    ctx.event.listen('input:change:target', ev => {
      if (!ev.value) return;
      camera.setTarget(new Vector3(ev.value.x, ev.value.y, ev.value.z), undefined, undefined, true);
    });
    ctx.event.listen('input:change:alpha', ev => {
      if (!ev.value) return;
      camera.alpha = Tools.ToRadians(ev.value);
    });
    ctx.event.listen('input:change:beta', ev => {
      if (!ev.value) return;
      camera.beta = Tools.ToRadians(ev.value);
    });
    ctx.event.listen('input:change:radius', ev => {
      if (!ev.value) return;
      camera.radius = ev.value;
    });
    ctx.event.listen('input:change:fov', ev => {
      if (!ev.value) return;
      camera.fov = ev.value;
    });
    ctx.event.listen('input:change:allowMove', ev => {
      camera.panningSensibility = ev.value ? 1000 : 0;
    });
    ctx.event.listen('input:change:allowControl', () => {
      if (ctx.input.allowControl) camera.attachControl();
      else camera.detachControl();
    });
    ctx.event.listen('input:change:isOrthographic', () => {
      camera.mode = ctx.input.isOrthographic ? Camera.ORTHOGRAPHIC_CAMERA : Camera.PERSPECTIVE_CAMERA;
    });

    notice();

    return () => {
      camera.dispose();

      if (obrOB) {
        ctx.host.onBeforeRenderObservable.remove(obrOB);
      }
    };
  },
});
