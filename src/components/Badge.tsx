import { ReactNode } from 'react';
import { classNames } from '@/lib/format';

interface BadgeProps {
  className?: string;
  children: ReactNode;
}

export function Badge({ className, children }: BadgeProps) {
  return (
    <span className={classNames('badge', className)}>
      {children}
    </span>
  );
}
