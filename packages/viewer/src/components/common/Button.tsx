/* ============================================================
 * Button - styled button with variants
 * ============================================================ */

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

type ButtonVariant = 'default' | 'primary' | 'ghost' | 'icon';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  children?: ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  default: 'dv-button',
  primary: 'dv-button dv-button-primary',
  ghost: 'dv-button dv-button-ghost',
  icon: 'dv-button dv-button-icon',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'dv-button-sm',
  md: 'dv-button-md',
  lg: 'dv-button-lg',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = 'default',
      size = 'md',
      icon,
      children,
      className,
      ...props
    },
    ref,
  ) {
    const classes = [
      VARIANT_CLASSES[variant],
      SIZE_CLASSES[size],
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button ref={ref} className={classes} {...props}>
        {icon && <span className="dv-button-icon-wrap" aria-hidden="true">{icon}</span>}
        {children}
      </button>
    );
  },
);
