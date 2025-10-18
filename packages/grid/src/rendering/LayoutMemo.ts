export class LayoutMemo {
  private cachedBaseYValue: number | null = null;
  private cachedBaseYRowHeight: number | null = null;
  private cachedBaseYHeaderHeight: number | null = null;
  private cachedBaseYFractionalTop: number | null = null;

  public getBaseY(rowHeight: number, headerHeight: number, scrollTop: number): number {
    const fractionalTop = scrollTop % rowHeight;
    if (
      this.cachedBaseYValue !== null &&
      this.cachedBaseYRowHeight === rowHeight &&
      this.cachedBaseYHeaderHeight === headerHeight &&
      this.cachedBaseYFractionalTop === fractionalTop
    ) {
      return this.cachedBaseYValue;
    }
    const value = headerHeight - fractionalTop;
    this.cachedBaseYValue = value;
    this.cachedBaseYRowHeight = rowHeight;
    this.cachedBaseYHeaderHeight = headerHeight;
    this.cachedBaseYFractionalTop = fractionalTop;
    return value;
  }
}


