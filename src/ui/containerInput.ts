import Phaser from 'phaser';

/**
 * setInteractive shim for Phaser Containers (top-level AND nested).
 *
 * Root cause: Phaser 3.90 hard-codes `Container.displayOriginX = width * 0.5`
 * (see node_modules/phaser/src/gameobjects/container/Container.js). When
 * Phaser's InputManager.pointWithinHitArea runs the hit test, it shifts the
 * local hit-test point by `(displayOriginX, displayOriginY)` BEFORE invoking
 * the hit-area callback — but Container rendering does NOT use the origin,
 * so the visual stays centered at local (0, 0). Result: clicks computed at
 * local (0, 0) are tested against the shape at local (w/2, h/2), missing
 * any hit area drawn around the origin.
 *
 * This affects EVERY Container that calls `setSize(w, h)`, regardless of
 * whether it has a parentContainer. The fix is to shift the hit-area shape
 * by `+ (w/2, h/2)` so it lines up with where Phaser does the test.
 *
 * Call this AFTER `setSize` so we read the final width/height.
 */
export function enableContainerInput(
  c: Phaser.GameObjects.Container,
  hitArea: Phaser.Geom.Circle | Phaser.Geom.Rectangle,
  callback: Phaser.Types.Input.HitAreaCallback,
): void {
  c.setInteractive(hitArea, callback);
  const dox = (c.width || 0) / 2;
  const doy = (c.height || 0) / 2;
  hitArea.x += dox;
  hitArea.y += doy;
}

/**
 * Unified button factory. Creates a Container at (x, y) with the requested
 * size, wires up a correctly-shifted rect or circle hit area, hover/press
 * tweens, and pointer cursor. The caller is responsible for drawing graphics
 * INTO the returned container at local coordinates centered on (0, 0).
 *
 * For circular buttons pass `{ shape: 'circle', radius }`. The width/height
 * used for sizing is `radius * 2`.
 */
export interface MakeButtonOpts {
  shape?: 'rect' | 'circle';
  /** Width (rect) — required when shape === 'rect'. */
  w?: number;
  /** Height (rect) — required when shape === 'rect'. */
  h?: number;
  /** Radius (circle) — required when shape === 'circle'. */
  radius?: number;
  /** Click handler. */
  onClick: () => void;
  /** Skip the built-in hover/press scale tweens (use when wrapper handles its own animation). */
  noHoverTween?: boolean;
  /** Optional: returns true if the button should ignore clicks right now. */
  isDisabled?: () => boolean;
  /** Override the default 'pointer' cursor. */
  cursor?: string;
  /** Hover scale (default 1.08). */
  hoverScale?: number;
  /** Press scale (default 0.92). */
  pressScale?: number;
}

export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  opts: MakeButtonOpts,
): Phaser.GameObjects.Container {
  const shape = opts.shape ?? 'rect';
  const c = scene.add.container(x, y);

  if (shape === 'circle') {
    const r = opts.radius!;
    c.setSize(r * 2, r * 2);
    enableContainerInput(c, new Phaser.Geom.Circle(0, 0, r), Phaser.Geom.Circle.Contains);
  } else {
    const w = opts.w!;
    const h = opts.h!;
    c.setSize(w, h);
    enableContainerInput(
      c,
      new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h),
      Phaser.Geom.Rectangle.Contains,
    );
  }

  const hoverScale = opts.hoverScale ?? 1.08;
  const pressScale = opts.pressScale ?? 0.92;
  const cursor = opts.cursor ?? 'pointer';

  c.on('pointerover', () => {
    if (opts.isDisabled?.()) return;
    scene.input.setDefaultCursor(cursor);
    if (!opts.noHoverTween) {
      scene.tweens.add({ targets: c, scale: hoverScale, duration: 110, ease: 'Sine.Out' });
    }
  });
  c.on('pointerout', () => {
    scene.input.setDefaultCursor('default');
    if (!opts.noHoverTween) {
      scene.tweens.add({ targets: c, scale: 1, duration: 110, ease: 'Sine.Out' });
    }
  });
  c.on('pointerdown', () => {
    if (opts.isDisabled?.()) return;
    if (!opts.noHoverTween) {
      scene.tweens.add({
        targets: c,
        scale: pressScale,
        duration: 70,
        yoyo: true,
        ease: 'Sine.Out',
      });
    }
    opts.onClick();
  });

  return c;
}
