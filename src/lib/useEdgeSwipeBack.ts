import { useRef } from 'react';
import type { TouchEventHandler } from 'react';

type EdgeSwipeHandlers = {
  onTouchCancel?: TouchEventHandler<HTMLElement>;
  onTouchEnd?: TouchEventHandler<HTMLElement>;
  onTouchMove?: TouchEventHandler<HTMLElement>;
  onTouchStart?: TouchEventHandler<HTMLElement>;
};

type UseEdgeSwipeBackOptions = {
  enabled?: boolean;
  onBack: () => void;
};

const EDGE_ACTIVATION_PX = 28;
const MIN_BACK_DISTANCE_PX = 72;
const MAX_VERTICAL_DRIFT_PX = 48;

export function useEdgeSwipeBack({
  enabled = true,
  onBack,
}: UseEdgeSwipeBackOptions): EdgeSwipeHandlers {
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const canTrackRef = useRef(false);

  const reset = () => {
    startXRef.current = null;
    startYRef.current = null;
    canTrackRef.current = false;
  };

  if (!enabled) {
    return {};
  }

  return {
    onTouchStart: (event) => {
      const touch = event.changedTouches[0];
      if (!touch) {
        reset();
        return;
      }

      startXRef.current = touch.clientX;
      startYRef.current = touch.clientY;
      canTrackRef.current = touch.clientX <= EDGE_ACTIVATION_PX;
    },
    onTouchMove: (event) => {
      if (!canTrackRef.current) {
        return;
      }

      const touch = event.changedTouches[0];
      const startX = startXRef.current;
      const startY = startYRef.current;
      if (!touch || startX === null || startY === null) {
        reset();
        return;
      }

      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;

      if (deltaX < -12 || Math.abs(deltaY) > MAX_VERTICAL_DRIFT_PX) {
        canTrackRef.current = false;
      }
    },
    onTouchEnd: (event) => {
      if (!canTrackRef.current) {
        reset();
        return;
      }

      const touch = event.changedTouches[0];
      const startX = startXRef.current;
      const startY = startYRef.current;
      if (!touch || startX === null || startY === null) {
        reset();
        return;
      }

      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;
      reset();

      if (deltaX >= MIN_BACK_DISTANCE_PX && Math.abs(deltaY) <= MAX_VERTICAL_DRIFT_PX) {
        onBack();
      }
    },
    onTouchCancel: () => {
      reset();
    },
  };
}
