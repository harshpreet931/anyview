import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Icon, type IconName } from '../common/Icon';

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'children'> {
  icon: IconName;
  label: string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, className, title = label, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={className ? `dv-button ${className}` : 'dv-button'}
      {...props}
      aria-label={label}
      title={title}
    >
      <Icon name={icon} />
    </button>
  );
});
