import { FlowNodeTypeRegistry, IFlowNodeTypeRegisterData } from 'ah-flow-node';
import { Container } from '@babylonjs/gui/2D/controls/container';
import { Control } from '@babylonjs/gui/2D/controls/control';
import { Vector2 } from '@babylonjs/core/Maths/math.vector';
import { Observable } from '@babylonjs/core/Misc/observable';
import { PointerInfoBase } from '@babylonjs/core/Events/pointerEvents';
import { ICanvasRenderingContext } from '@babylonjs/core/Engines/ICanvas';
import { Tools } from '@babylonjs/core/Misc/tools';
import { toOuterVec } from '../lib/toVec';
import { getHostUiTex } from '../lib/getHostUiTex';

export const getJoystickNodeRegisterData = (): IFlowNodeTypeRegisterData<'JoystickNode'> => ({
  ...FlowNodeTypeRegistry.Default.get('JoystickNode')!,
  setup(ctx) {
    const hardwareScale = ctx.host.getEngine().getHardwareScalingLevel() || 1;
    const uiTex = getHostUiTex(ctx.host);

    const container = new Container('JoystickWheel_' + ctx.ID);
    container.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    container.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    container.leftInPixels = 40 / hardwareScale;
    container.topInPixels = -40 / hardwareScale;
    container.widthInPixels = 150 / hardwareScale;
    container.heightInPixels = 150 / hardwareScale;

    // 行走轮盘
    const wheel = new JoystickWheel('JoystickWheel');
    container.addControl(wheel);

    uiTex.addControl(container);

    const ob1 = wheel.onForwardChangedObservable.add(forward => (ctx.output.vector = toOuterVec(forward, true)));

    return () => {
      if (ob1) ob1.unregisterOnNextCall = true;
      container.dispose();
    };
  },
});

class JoystickWheel extends Container {
  private _pointerIsDown = false;
  private _lastPointerDownId = -1;

  private _wheelForward: Vector2 = Vector2.Zero();

  onForwardChangedObservable = new Observable<Vector2>();

  constructor(public name?: string) {
    super(name);
    this.isPointerBlocker = true;
  }

  public _onPointerDown(
    target: Control,
    coordinates: Vector2,
    pointerId: number,
    buttonIndex: number,
    pi: PointerInfoBase
  ): boolean {
    if (!super._onPointerDown(target, coordinates, pointerId, buttonIndex, pi)) {
      return false;
    }

    if (this.isReadOnly) return true;

    this._host._capturingControl[pointerId] = this;
    this._lastPointerDownId = pointerId;
    this._pointerIsDown = true;

    this.updateMove(coordinates.x, coordinates.y);

    return true;
  }

  public _onPointerUp(
    target: Control,
    coordinates: Vector2,
    pointerId: number,
    buttonIndex: number,
    notifyClick: boolean
  ): void {
    this._pointerIsDown = false;
    delete this._host._capturingControl[pointerId];
    this.cleanMove();
    super._onPointerUp(target, coordinates, pointerId, buttonIndex, notifyClick);
  }

  public _onPointerMove(target: Control, coordinates: Vector2, pointerId: number, pi: PointerInfoBase): void {
    if (pointerId != this._lastPointerDownId) return;
    if (this._pointerIsDown && !this.isReadOnly) this.updateMove(coordinates.x, coordinates.y);
    super._onPointerMove(target, coordinates, pointerId, pi);
  }

  private updateMove(x: number, y: number) {
    this._wheelForward.set(x - this.centerX, y - this.centerY).normalize();
    this._markAsDirty();
    this.onForwardChangedObservable.notifyObservers(this._wheelForward);
  }

  private cleanMove() {
    this._wheelForward.set(0, 0);
    this._markAsDirty();
    this.onForwardChangedObservable.notifyObservers(this._wheelForward);
  }

  protected _localDraw(ctx: ICanvasRenderingContext): void {
    if (!this._isEnabled) {
      ctx.clearRect(0, 0, this.widthInPixels, this.heightInPixels);
      return;
    }

    ctx.save();

    const centerX = this.centerX;
    const centerY = this.centerY;

    const safeRadius = Math.min(this.widthInPixels, this.heightInPixels) / 2 - 20;

    // 实心圆
    ctx.beginPath();
    ctx.arc(centerX, centerY, safeRadius, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(10,10,10,0.02)';
    ctx.fill();

    ctx.lineWidth = 9;
    ctx.strokeStyle = 'rgba(125,125,125,0.4)';

    // 环
    ctx.beginPath();
    ctx.arc(centerX, centerY, safeRadius - ctx.lineWidth / 2, 0, 2 * Math.PI);
    ctx.stroke();

    // 方向指示
    if (this._wheelForward.lengthSquared() > 0) {
      let sita = Math.acos(this._wheelForward.x / this._wheelForward.length());
      if (this._wheelForward.y <= 0) sita = 2 * Math.PI - sita;

      ctx.strokeStyle = 'green';
      (ctx as any).lineCap = 'round';

      // 弧线
      ctx.beginPath();
      ctx.arc(centerX, centerY, safeRadius - ctx.lineWidth / 2, sita - Tools.ToRadians(35), sita + Tools.ToRadians(35));
      ctx.stroke();

      // 上三角
      ctx.lineWidth = 1;
      ctx.fillStyle = 'green';

      const tp1 = Vector2.Zero();
      const tp2 = Vector2.Zero();
      const tp3 = Vector2.Zero();

      Vector2.FromArray([safeRadius + 7, 0]).rotateToRef(sita + Tools.ToRadians(8), tp1);
      Vector2.FromArray([safeRadius + 7, 0]).rotateToRef(sita - Tools.ToRadians(8), tp2);
      Vector2.FromArray([safeRadius + 14, 0]).rotateToRef(sita, tp3);

      tp1.x += centerX;
      tp1.y += centerY;
      tp2.x += centerX;
      tp2.y += centerY;
      tp3.x += centerX;
      tp3.y += centerY;

      ctx.beginPath();
      ctx.moveTo(tp1.x, tp1.y);
      ctx.lineTo(tp2.x, tp2.y);
      ctx.lineTo(tp3.x, tp3.y);
      ctx.lineTo(tp1.x, tp1.y);
      ctx.stroke();
      ctx.fill();
    }

    ctx.restore();
  }
}
