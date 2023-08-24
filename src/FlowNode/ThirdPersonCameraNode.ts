import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { FlowNodeTypeRegistry, IFlowNodeTypeRegisterData, Util } from 'ah-flow-node';
import { toInnerVec, toOuterVec } from '../lib/toVec';
import { IThirdPersonCameraNode_springMode, LerpManager } from 'xr-core';
import { Ray } from '@babylonjs/core/Culling/ray';
import { isInBoundBox } from '../lib/isInBoundBox';
import { Scalar } from '@babylonjs/core/Maths/math.scalar';
import type { Scene } from '@babylonjs/core';

export const getThirdPersonCameraNodeRegisterData = (): IFlowNodeTypeRegisterData<'ThirdPersonCameraNode'> => ({
  ...FlowNodeTypeRegistry.Default.get('ThirdPersonCameraNode')!,
  setup(ctx) {
    let lerpDuration = 800;
    let minRadius = 1;
    let targetBoundBox: { center: Vector3; size: Vector3 } | undefined;

    const cam = new ArcRotateCamera(
      '第三人称相机_' + ctx.ID,
      0,
      Math.PI / 2,
      ctx.input.radius || 10,
      Vector3.Zero(),
      ctx.host,
      true
    );
    cam.attachControl();
    cam.allowUpsideDown = false;
    cam.minZ = 0.1;
    cam.lowerRadiusLimit = 0.1;

    // 关掉滚轮
    cam.useNaturalPinchZoom = true;
    cam.wheelDeltaPercentage = 0;
    cam.inputs.removeByType('ArcRotateCameraMouseWheelInput');

    // 关掉平移
    cam.panningInertia = 0;
    cam.panningSensibility = 0;

    // 关闭其他事件
    cam.inputs.removeByType('ArcRotateCameraKeyboardMoveInput');

    ctx.output.camera = cam;

    // 半径缓动
    const radiusLerp = new LerpManager(ctx.host, Scalar.Lerp.bind(Scalar), _r => (cam.radius = _r));

    // 恢复原 radius
    function resetCameraPosition() {
      if (ctx.input.radius) radiusLerp.update(ctx.input.radius, lerpDuration);
    }

    function reloadTargetBoundBox() {
      if (!ctx.input.targetBoundBox) return;

      targetBoundBox = {
        center: toInnerVec(ctx.input.targetBoundBox.center).add(new Vector3(0, ctx.input.offsetY || 0, 0)),
        size: toInnerVec(ctx.input.targetBoundBox.size),
      };

      const ct = calcCameraTarget({ camBeta: cam.beta, targetBoundBox });
      cam.setTarget(ct, undefined, undefined, true);

      // 最小距离 = 包围盒对角线长度的一半
      minRadius = targetBoundBox.size.length() / 2;
    }

    // 每帧检查
    function updateByTick() {
      cam.computeWorldMatrix();
      ctx.output.position = toOuterVec(cam.globalPosition, true);

      if (!ctx.input.radius || !targetBoundBox) return;

      // 更新相机焦点
      const ct = calcCameraTarget({ camBeta: cam.beta, targetBoundBox });
      cam.setTarget(ct, undefined, undefined, true);
      ctx.output.target = toOuterVec(ct);

      if (radiusLerp.isInterpolating) return; // 正在 lerp 的时候不要处理

      if (!ctx.input.springMode) {
        resetCameraPosition();
        return;
      }

      const _pitchR = calcPitchEvaluateRadius({
        camTarget: cam.target,
        camBeta: cam.beta,
        camPos: cam.globalPosition,
        radius: ctx.input.radius,
        targetBoundBox,
      });
      if (!_pitchR) return resetCameraPosition();

      const springMode = ctx.input.springMode as IThirdPersonCameraNode_springMode;

      // 镜头碰撞模式
      if (springMode === 'collision') {
        const _collR = calcCollisionEvaluateRadius({
          camTarget: cam.target,
          camPos: cam.globalPosition,
          radius: ctx.input.radius,
          targetBoundBox,
          scene: ctx.host,
          minRadius,
        });

        const radius = _collR && _collR < _pitchR ? _collR : _pitchR;
        radiusLerp.update(radius, radius === _pitchR ? 0 : 100);
      }

      // 射线遮挡模式
      else if (springMode === 'occlusion') {
        const _occlusionR = calcOcclusionEvaluateRadius({
          camTarget: cam.target,
          camPos: cam.globalPosition,
          radius: ctx.input.radius,
          targetBoundBox,
          scene: ctx.host,
          minRadius,
        });

        const radius = _occlusionR && _occlusionR < _pitchR ? _occlusionR : _pitchR;
        radiusLerp.update(radius, radius === _pitchR ? 0 : 100);
      }

      // 只处理俯仰变化修正
      else {
        radiusLerp.update(_pitchR, 0);
      }
    }

    function notice() {
      ctx.host.event.emit('__afterCameraNodeChange', { node: ctx as any, _bubble: true });
    }

    const removeRenderListen = ctx.host.event.listen('beforeRender', updateByTick);

    const flusher = Util.createNodeFlusher(ctx, {
      name: notice,
      targetBoundBox: reloadTargetBoundBox,
      offsetY: reloadTargetBoundBox,
      alpha: function () {
        if (typeof ctx.input.alpha === 'undefined') return;
        cam.alpha = (ctx.input.alpha / 180) * Math.PI;
      },
      beta: function () {
        if (typeof ctx.input.beta === 'undefined') return;
        cam.beta = (ctx.input.beta / 180) * Math.PI;
      },
      radius: function () {
        if (!ctx.input.radius) return;
        cam.radius = ctx.input.radius;
      },
      lerpDuration: function () {
        if (ctx.input.lerpDuration) lerpDuration = ctx.input.lerpDuration;
      },
      springMode: function () {},

      _meta: function () {},
    });

    flusher.bindInputEvent();
    flusher.keys.forEach(key => flusher.handler[key]());

    notice();

    return () => {
      cam.dispose();
      radiusLerp.destroy();
      removeRenderListen();
    };
  },
});

// 俯仰变化修正的 radius 值
function calcPitchEvaluateRadius(arg: {
  camTarget: Vector3;
  camPos: Vector3;
  camBeta: number;
  radius: number;
  targetBoundBox: { center: Vector3; size: Vector3 };
}) {
  const bottomY = arg.targetBoundBox.center.y - arg.targetBoundBox.size.y / 2;
  const h = (arg.camTarget.y - bottomY) * 0.85; // h 减去一点离地距离，避免相机过于贴近地面

  const betaBp = Math.PI - Math.acos(h / arg.radius);
  if (arg.camBeta < betaBp) return arg.radius;

  const radius = (h / Math.cos(Math.PI - arg.camBeta)) * ((Math.PI - arg.camBeta) / (Math.PI - betaBp));
  return radius;
}

// 射线遮挡修正的 radius 值
function calcOcclusionEvaluateRadius(arg: {
  camTarget: Vector3;
  camPos: Vector3;
  radius: number;
  targetBoundBox: { center: Vector3; size: Vector3 };
  scene: Scene;
  minRadius: number;
}) {
  const scene = arg.scene;
  const camEndpoint = calcCameraRayEndpoint(arg);

  const targetCenter = arg.camTarget;
  const rayForward = camEndpoint.to.subtract(camEndpoint.from);
  const invRayToCamEp = new Ray(camEndpoint.from, rayForward.clone().normalize(), rayForward.length());

  const targetSize = arg.targetBoundBox.size;
  const targetSizeNum = targetSize.length();

  const targetSizeX =
    targetSizeNum < arg.minRadius ? targetSize.scale(arg.minRadius / targetSizeNum) : targetSize.clone();
  targetSizeX.x += 0.5;
  targetSizeX.y += 0.5;
  targetSizeX.z += 0.5;

  const pickingInfo = scene.pickWithRay(invRayToCamEp, m => {
    return m.isVisible && m.isPickable && m.isEnabled() && !isInBoundBox(targetCenter, targetSizeX, m.absolutePosition);
  });
  if (!pickingInfo || !pickingInfo.pickedPoint) return;

  const radius = targetCenter.subtract(pickingInfo.pickedPoint).length() - 0.1;
  return radius;
}

function calcCameraTarget(arg: { camBeta: number; targetBoundBox: { center: Vector3; size: Vector3 } }) {
  const targetCenter = arg.targetBoundBox.center;
  const targetSize = arg.targetBoundBox.size;

  const newCameraTarget = targetCenter.clone();
  const offsetY = (arg.camBeta / Math.PI) * targetSize.y;

  newCameraTarget.y += offsetY;

  return newCameraTarget;
}

// 相机射线端点
function calcCameraRayEndpoint(arg: { camTarget: Vector3; camPos: Vector3; radius: number; minRadius: number }) {
  const gPos = arg.camPos;

  const targetCenter = arg.camTarget;
  const gPosVec = targetCenter.subtract(gPos);

  const scaleRateA = arg.minRadius / gPosVec.length();
  const from = targetCenter.subtract(gPosVec.scale(scaleRateA));

  const scaleRateB = arg.radius / gPosVec.length();
  const to = targetCenter.subtract(gPosVec.scale(scaleRateB));

  return { from, to };
}

function calcCollisionEvaluateRadius(arg: {
  camTarget: Vector3;
  camPos: Vector3;
  radius: number;
  targetBoundBox: { center: Vector3; size: Vector3 };
  scene: Scene;
  minRadius: number;
}) {
  const scene = arg.scene;
  const camEndpoint = calcCameraRayEndpoint(arg);

  const nRayForward = camEndpoint.to.subtract(camEndpoint.from).normalize();
  const invRay = new Ray(camEndpoint.to.subtract(nRayForward), nRayForward, nRayForward.length());

  const pickingInfo = scene.pickWithRay(invRay);
  if (!pickingInfo || !pickingInfo.pickedPoint) return;

  const radius = arg.camTarget.subtract(pickingInfo.pickedPoint).length() - 0.1;
  return radius;
}
