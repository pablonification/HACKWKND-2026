import type { CSSProperties, HTMLAttributes } from 'react';

type AppSkeletonProps = HTMLAttributes<HTMLDivElement> & {
  width?: CSSProperties['width'];
  height?: CSSProperties['height'];
};

export function AppSkeleton({ className, style, width, height, ...props }: AppSkeletonProps) {
  const mergedStyle =
    width !== undefined || height !== undefined ? { ...style, width, height } : style;

  return (
    <div
      {...props}
      aria-hidden="true"
      className={['app-skeleton', className].filter(Boolean).join(' ')}
      style={mergedStyle}
    />
  );
}
