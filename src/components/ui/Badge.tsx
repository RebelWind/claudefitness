import type { ExerciseGroup } from '../../types/exercise';
import { GROUP_COLORS } from '../../constants/exercises';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'accent';
  group?: ExerciseGroup;
}

const variants = {
  default: 'bg-surface-light text-text-muted',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  error: 'bg-error/15 text-error',
  accent: 'bg-accent/15 text-accent',
};

export default function Badge({ children, variant = 'default', group }: BadgeProps) {
  const cls = group
    ? `${GROUP_COLORS[group].bg} ${GROUP_COLORS[group].text}`
    : variants[variant];

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {children}
    </span>
  );
}
