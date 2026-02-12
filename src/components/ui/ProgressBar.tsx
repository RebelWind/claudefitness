interface ProgressBarProps {
  value: number; // 0-100
  className?: string;
  color?: 'primary' | 'success' | 'warning' | 'accent';
}

const colors = {
  primary: 'bg-primary-light',
  success: 'bg-success',
  warning: 'bg-warning',
  accent: 'bg-accent',
};

export default function ProgressBar({ value, className = '', color = 'primary' }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div className={`h-2 bg-surface-light rounded-full overflow-hidden ${className}`}>
      <div
        className={`h-full rounded-full transition-all duration-500 ${colors[color]}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
