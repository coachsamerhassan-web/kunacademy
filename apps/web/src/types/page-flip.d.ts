declare module 'page-flip' {
  export interface FlipSetting {
    startPage: number;
    size: 'fixed' | 'stretch';
    width: number;
    height: number;
    minWidth: number;
    maxWidth: number;
    minHeight: number;
    maxHeight: number;
    drawShadow: boolean;
    flippingTime: number;
    usePortrait: boolean;
    startZIndex: number;
    autoSize: boolean;
    maxShadowOpacity: number;
    showCover: boolean;
    mobileScrollSupport: boolean;
    clickEventForward: boolean;
    useMouseEvents: boolean;
    swipeDistance: number;
    showPageCorners: boolean;
    disableFlipByClick: boolean;
    rtl: boolean;
  }

  export class PageFlip {
    constructor(element: HTMLElement, setting: Partial<FlipSetting>);
    loadFromImages(imagesHref: string[]): void;
    loadFromHTML(items: NodeListOf<HTMLElement> | HTMLElement[]): void;
    updateFromImages(imagesHref: string[]): void;
    updateFromHtml(items: NodeListOf<HTMLElement> | HTMLElement[]): void;
    destroy(): void;
    update(): void;
    flip(page: number, corner?: string): void;
    flipNext(corner?: string): void;
    flipPrev(corner?: string): void;
    turnToPage(page: number): void;
    turnToNextPage(): void;
    turnToPrevPage(): void;
    getCurrentPageIndex(): number;
    getPageCount(): number;
    getOrientation(): string;
    on(event: string, callback: (e: { data: number | string | boolean | object; object: PageFlip }) => void): PageFlip;
  }
}
