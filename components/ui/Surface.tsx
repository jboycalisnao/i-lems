import React, { forwardRef, type HTMLAttributes } from 'react';

type SurfaceProps = HTMLAttributes<HTMLDivElement>;

const mergeClasses = (base: string, className?: string) =>
  className ? `${base} ${className}` : base;

export const Box = forwardRef<HTMLDivElement, SurfaceProps>(({ className, ...props }, ref) => (
  <div ref={ref} className={mergeClasses('rounded-md', className)} {...props} />
));

Box.displayName = 'Box';

export const Card = forwardRef<HTMLDivElement, SurfaceProps>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={mergeClasses('rounded-md border border-gray-200 bg-white shadow-sm', className)}
    {...props}
  />
));

Card.displayName = 'Card';
