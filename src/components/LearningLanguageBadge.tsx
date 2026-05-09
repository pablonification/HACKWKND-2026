import { chevronDownOutline, globeOutline } from 'ionicons/icons';
import { IonIcon } from '@ionic/react';

import './LearningLanguageBadge.css';

type LearningLanguageBadgeVariant = 'home' | 'compact';

type LearningLanguageBadgeProps = {
  language: string;
  variant?: LearningLanguageBadgeVariant;
  onClick?: () => void;
  className?: string;
};

export function LearningLanguageBadge({
  language,
  variant = 'compact',
  onClick,
  className,
}: LearningLanguageBadgeProps) {
  const label = language;
  const classes = ['learning-language-badge', `learning-language-badge--${variant}`, className]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={classes}
      onClick={onClick}
      aria-label={`Learning language: ${language}`}
    >
      <IonIcon className="learning-language-badge-icon" icon={globeOutline} aria-hidden="true" />
      <span>{label}</span>
      <IonIcon
        className="learning-language-badge-chevron"
        icon={chevronDownOutline}
        aria-hidden="true"
      />
    </button>
  );
}
