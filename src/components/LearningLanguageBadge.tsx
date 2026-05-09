import { chevronDownOutline } from 'ionicons/icons';
import { IonIcon } from '@ionic/react';

import { getLearningLanguageMetadata } from '../lib/learningLanguages';

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
  const metadata = getLearningLanguageMetadata(language);
  const classes = ['learning-language-badge', `learning-language-badge--${variant}`, className]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={classes}
      onClick={onClick}
      aria-label={`Learning language: ${metadata.language}, ${metadata.country}`}
    >
      <span className="learning-language-badge-flag" aria-hidden="true">
        <img src={metadata.flagSrc} alt="" draggable={false} />
      </span>
      <span className="learning-language-badge-copy">
        <span className="learning-language-badge-name">{metadata.language}</span>
        <span className="learning-language-badge-country">{metadata.country}</span>
      </span>
      <IonIcon
        className="learning-language-badge-chevron"
        icon={chevronDownOutline}
        aria-hidden="true"
      />
    </button>
  );
}
