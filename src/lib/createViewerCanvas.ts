/** 创建适合于 viewer 的 canvas */
export function createViewerCanvas() {
  const canvas = document.createElement('canvas');

  canvas.style.display = 'block';
  canvas.style.height = '100%';
  canvas.style.width = '100%';
  canvas.style.outline = 'none';

  (canvas.style as any)['-webkit-touch-callout'] = 'none';
  (canvas.style as any)['-webkit-user-select'] = 'none';
  canvas.style.userSelect = 'none';

  return canvas;
}
