import React, { useCallback, useEffect, useRef, useState } from 'react';

type DashboardListScrollbarProps = {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  thumbTrackPadding?: number;
  horizontalTrackPadding?: number;
};

export const DashboardListScrollbar: React.FC<DashboardListScrollbarProps> = ({
  children,
  className = '',
  contentClassName = 'pr-0',
  thumbTrackPadding = 0,
  horizontalTrackPadding = 8,
}) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; startY: number; startScrollTop: number } | null>(null);
  const horizontalDragRef = useRef<{ pointerId: number; startX: number; startScrollLeft: number } | null>(null);
  const [scrollbar, setScrollbar] = useState({ height: 0, top: 0, width: 0, left: 0 });

  const updateScrollbar = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const maxScrollTop = viewport.scrollHeight - viewport.clientHeight;
    const maxScrollLeft = viewport.scrollWidth - viewport.clientWidth;
    const trackHeight = Math.max(0, viewport.clientHeight - thumbTrackPadding * 2);
    const height = maxScrollTop > 0
      ? Math.min(trackHeight, Math.max(24, (trackHeight * viewport.clientHeight) / viewport.scrollHeight))
      : 0;
    const top = maxScrollTop > 0
      ? thumbTrackPadding + (viewport.scrollTop / maxScrollTop) * (trackHeight - height)
      : 0;
    const trackWidth = Math.max(0, viewport.clientWidth - horizontalTrackPadding * 2);
    const width = maxScrollLeft > 0
      ? Math.min(trackWidth, Math.max(24, (trackWidth * viewport.clientWidth) / viewport.scrollWidth))
      : 0;
    const left = maxScrollLeft > 0
      ? horizontalTrackPadding + (viewport.scrollLeft / maxScrollLeft) * (trackWidth - width)
      : 0;

    setScrollbar((current) =>
      current.height === height && current.top === top && current.width === width && current.left === left
        ? current
        : { height, top, width, left }
    );
  }, [horizontalTrackPadding, thumbTrackPadding]);

  useEffect(() => {
    const viewport = viewportRef.current;
    const content = viewport?.firstElementChild;
    if (!viewport || !content) return;

    const observer = new ResizeObserver(updateScrollbar);
    observer.observe(viewport);
    observer.observe(content);
    const table = content.querySelector('table');
    if (table) observer.observe(table);
    const frame = requestAnimationFrame(updateScrollbar);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [updateScrollbar]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startScrollTop: viewport.scrollTop,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    const drag = dragRef.current;
    const scrollRange = viewport
      ? viewport.clientHeight - thumbTrackPadding * 2 - scrollbar.height
      : 0;
    if (!viewport || !drag || drag.pointerId !== event.pointerId || scrollRange <= 0) return;

    const maxScrollTop = viewport.scrollHeight - viewport.clientHeight;
    viewport.scrollTop = drag.startScrollTop + ((event.clientY - drag.startY) / scrollRange) * maxScrollTop;
  };

  const handleHorizontalPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    horizontalDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: viewport.scrollLeft,
    };
  };

  const handleHorizontalPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    const drag = horizontalDragRef.current;
    const scrollRange = viewport
      ? viewport.clientWidth - horizontalTrackPadding * 2 - scrollbar.width
      : 0;
    if (!viewport || !drag || drag.pointerId !== event.pointerId || scrollRange <= 0) return;

    const maxScrollLeft = viewport.scrollWidth - viewport.clientWidth;
    viewport.scrollLeft = drag.startScrollLeft + ((event.clientX - drag.startX) / scrollRange) * maxScrollLeft;
  };

  return (
    <div className={`dashboard-list-scroll-container relative min-h-0 ${className}`}>
      <div
        ref={viewportRef}
        onScroll={updateScrollbar}
        className="dashboard-list-scrollbar h-full overflow-auto"
      >
        <div className={contentClassName}>{children}</div>
      </div>
      {scrollbar.height > 0 && (
        <div
          aria-hidden="true"
          className="dashboard-list-scroll-thumb absolute right-0 top-0 z-20 w-1 rounded-full bg-bakery-dark touch-none cursor-pointer"
          style={{ height: scrollbar.height, transform: `translateY(${scrollbar.top}px)` }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={() => { dragRef.current = null; }}
          onPointerCancel={() => { dragRef.current = null; }}
        />
      )}
      {scrollbar.width > 0 && (
        <div
          aria-hidden="true"
          className="dashboard-list-horizontal-scroll-thumb absolute bottom-0 left-0 z-20 h-1 rounded-full bg-bakery-dark touch-none cursor-pointer"
          style={{ width: scrollbar.width, transform: `translateX(${scrollbar.left}px)` }}
          onPointerDown={handleHorizontalPointerDown}
          onPointerMove={handleHorizontalPointerMove}
          onPointerUp={() => { horizontalDragRef.current = null; }}
          onPointerCancel={() => { horizontalDragRef.current = null; }}
        />
      )}
    </div>
  );
};
