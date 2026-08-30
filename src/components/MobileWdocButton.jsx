import { useEffect, useRef, useState } from 'react';

const POSITION_KEY = 'webdav-mobile-wdoc-position-v1';
const VIEWPORT_MARGIN = 10;

const clampPosition = (x, y, width, height) => ({
  x: Math.min(Math.max(VIEWPORT_MARGIN, x), Math.max(VIEWPORT_MARGIN, window.innerWidth - width - VIEWPORT_MARGIN)),
  y: Math.min(Math.max(VIEWPORT_MARGIN, y), Math.max(VIEWPORT_MARGIN, window.innerHeight - height - VIEWPORT_MARGIN)),
});

export default function MobileWdocButton({ open, onToggle, onPositionChange }) {
  const buttonRef = useRef(null);
  const dragRef = useRef(null);
  const suppressClickRef = useRef(false);
  const [position, setPosition] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(POSITION_KEY) || 'null');
      return Number.isFinite(saved?.x) && Number.isFinite(saved?.y) ? saved : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (position || !buttonRef.current) return;
    const media = window.matchMedia('(max-width: 767px)');
    let frame = 0;
    const placeAtDefault = () => {
      if (!media.matches) return;
      frame = window.requestAnimationFrame(() => {
        const rect = buttonRef.current?.getBoundingClientRect();
        if (!rect?.width || !rect?.height) return;
        setPosition(clampPosition(VIEWPORT_MARGIN + rect.width, VIEWPORT_MARGIN, rect.width, rect.height));
      });
    };
    placeAtDefault();
    media.addEventListener('change', placeAtDefault);
    return () => {
      window.cancelAnimationFrame(frame);
      media.removeEventListener('change', placeAtDefault);
    };
  }, [position]);

  useEffect(() => {
    if (position) localStorage.setItem(POSITION_KEY, JSON.stringify(position));
  }, [position]);

  useEffect(() => {
    if (!position || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    onPositionChange?.({ x: rect.left, y: rect.top, width: rect.width, height: rect.height });
  }, [onPositionChange, position]);

  useEffect(() => {
    const keepInViewport = () => {
      if (!position || !buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      const next = clampPosition(position.x, position.y, rect.width, rect.height);
      if (next.x !== position.x || next.y !== position.y) setPosition(next);
    };
    window.addEventListener('resize', keepInViewport);
    window.visualViewport?.addEventListener('resize', keepInViewport);
    return () => {
      window.removeEventListener('resize', keepInViewport);
      window.visualViewport?.removeEventListener('resize', keepInViewport);
    };
  }, [position]);

  const handlePointerDown = (event) => {
    if (event.button !== 0 || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(deltaX, deltaY) < 4) return;
    drag.moved = true;
    suppressClickRef.current = true;
    setPosition(clampPosition(drag.left + deltaX, drag.top + deltaY, drag.width, drag.height));
  };

  const handlePointerUp = (event) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    onToggle();
  };

  return <button
    ref={buttonRef}
    type="button"
    className={`mobile-wdoc-button ${open ? 'is-open' : ''}`}
    style={position ? { left: position.x, top: position.y } : { opacity: 0 }}
    onClick={handleClick}
    onPointerDown={handlePointerDown}
    onPointerMove={handlePointerMove}
    onPointerUp={handlePointerUp}
    onPointerCancel={handlePointerUp}
    aria-label={open ? 'wDoc 탐색기 닫기' : 'wDoc 탐색기 열기'}
    aria-expanded={open}
    aria-controls="webdav-explorer-panel"
    title="탭하여 탐색기 열기 · 드래그하여 이동"
  >
    wDoc
  </button>;
}
