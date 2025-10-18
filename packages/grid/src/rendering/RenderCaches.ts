import type { ThemeTokens } from '../types';

export class RenderCaches {
  private ctx: CanvasRenderingContext2D;

  private currentFont?: string;
  private currentFillStyle?: string | CanvasGradient | CanvasPattern;
  private currentTextAlign?: CanvasTextAlign;
  private currentTextBaseline?: CanvasTextBaseline;

  public frameTextCacheByColumn: Array<Map<string, { text: string; wasTruncated: boolean }>> | null = null;
  public frameCellFont: string | null = null;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  public beginFrame(theme: ThemeTokens, columnCount: number): void {
    this.currentFont = undefined;
    this.currentFillStyle = undefined;
    this.currentTextAlign = undefined;
    this.currentTextBaseline = undefined;

    this.frameTextCacheByColumn = new Array(Math.max(0, columnCount))
      .fill(0)
      .map(() => new Map());

    this.frameCellFont = `${theme.textSm * 16}px ${theme.fontSans}`;
    this.setFont(this.frameCellFont);
    this.setTextBaseline('middle');
  }

  public endFrame(): void {
    this.frameTextCacheByColumn = null;
    this.frameCellFont = null;
  }

  public setFont(font: string): void {
    if (this.currentFont !== font) {
      this.ctx.font = font;
      this.currentFont = font;
    }
  }

  public setFillStyle(style: string | CanvasGradient | CanvasPattern): void {
    if (this.currentFillStyle !== style) {
      this.ctx.fillStyle = style as any;
      this.currentFillStyle = style;
    }
  }

  public setTextAlign(align: CanvasTextAlign): void {
    if (this.currentTextAlign !== align) {
      this.ctx.textAlign = align;
      this.currentTextAlign = align;
    }
  }

  public setTextBaseline(baseline: CanvasTextBaseline): void {
    if (this.currentTextBaseline !== baseline) {
      this.ctx.textBaseline = baseline;
      this.currentTextBaseline = baseline;
    }
  }
}


