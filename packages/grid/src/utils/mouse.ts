import type React from 'react';

type CanvasMouseHandler = React.MouseEventHandler<HTMLCanvasElement>;

export function composeMouseHandlers(
  internalHandler?: CanvasMouseHandler,
  externalHandler?: CanvasMouseHandler,
): CanvasMouseHandler | undefined {
  if (internalHandler && externalHandler) {
    return (event) => {
      internalHandler(event);
      externalHandler(event);
    };
  }
  return internalHandler ?? externalHandler;
}
