import { IonContent, IonIcon, IonPage, IonToast } from '@ionic/react';
import {
  bookOutline,
  chatbubbleEllipsesOutline,
  chevronBackOutline,
  gameControllerOutline,
  globeOutline,
  homeOutline,
  languageOutline,
  leafOutline,
  libraryOutline,
  micOutline,
  musicalNotesOutline,
  peopleOutline,
  schoolOutline,
  sparklesOutline,
  trailSignOutline,
} from 'ionicons/icons';
import { useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';

import authTopPattern from '../../assets/auth/auth-top-pattern.png';
import { triggerHapticFeedback } from '../lib/feedback';
import { completeProfileOnboarding, type OnboardingResponses } from '../lib/profile';
import { useAuthStore } from '../stores/authStore';

import './OnboardingPage.css';

type SelectMode = 'single' | 'multi';
type StepKind = 'list' | 'cards' | 'summary';

type Option = {
  id: string;
  label: string;
  description?: string;
  icon: string;
  flag?: string;
  backgroundClassName?: string;
};

type OnboardingStep = {
  key: keyof OnboardingResponses | 'summary';
  title: string;
  subtitle?: string;
  kind: StepKind;
  mode?: SelectMode;
  options?: Option[];
};

type OnboardingPageProps = {
  onCompleted?: () => void;
};

const PURPOSE_OPTIONS: Option[] = [
  { id: 'learn-language', label: 'Learn an indigenous language', icon: languageOutline },
  { id: 'preserve-heritage', label: 'Preserve family heritage', icon: leafOutline },
  { id: 'discover-stories', label: 'Discover cultural stories', icon: bookOutline },
  { id: 'record-elders', label: 'Record stories from elders', icon: micOutline },
  { id: 'practice-semai', label: 'Practice speaking Semai', icon: chatbubbleEllipsesOutline },
  { id: 'explore-cultures', label: 'Explore Southeast Asian cultures', icon: globeOutline },
  { id: 'learn-games', label: 'Learn through games', icon: gameControllerOutline },
  { id: 'support-languages', label: 'Support endangered languages', icon: sparklesOutline },
];

const CULTURE_OPTIONS: Option[] = [
  {
    id: 'stories-folktales',
    label: 'Stories & folktales',
    description: 'Myths, legends, and narratives passed down.',
    icon: peopleOutline,
  },
  {
    id: 'music-oral',
    label: 'Music & Oral Tradition',
    description: 'Songs, chants, and spoken history.',
    icon: musicalNotesOutline,
  },
  {
    id: 'language-conversations',
    label: 'Language & conversations',
    description: 'Native tongues and dialects.',
    icon: languageOutline,
  },
  {
    id: 'family-heritage',
    label: 'Family heritage',
    description: 'Ancestry and generational bonds.',
    icon: homeOutline,
  },
  {
    id: 'indigenous-wisdom',
    label: 'Indigenous wisdom',
    description: 'Connection to land and ancient practices.',
    icon: leafOutline,
  },
  {
    id: 'traditional-arts',
    label: 'Traditional arts',
    description: 'Crafts, weaving, and visual expressions.',
    icon: sparklesOutline,
  },
];

const FAMILIARITY_OPTIONS: Option[] = [
  { id: 'new', label: 'I am completely new', icon: trailSignOutline },
  { id: 'few-words', label: 'I know a few words', icon: libraryOutline },
  { id: 'heard-it', label: 'I grew up hearing it', icon: homeOutline },
  { id: 'speak', label: 'I can speak conversationally', icon: chatbubbleEllipsesOutline },
  { id: 'teach-preserve', label: 'I want to teach or preserve it', icon: schoolOutline },
];

const COUNTRY_OPTIONS: Option[] = [
  {
    id: 'Indonesia',
    label: 'Indonesia',
    flag: '🇮🇩',
    icon: '',
    backgroundClassName: 'is-indonesia',
  },
  { id: 'Malaysia', label: 'Malaysia', flag: '🇲🇾', icon: '', backgroundClassName: 'is-malaysia' },
  { id: 'Thailand', label: 'Thailand', flag: '🇹🇭', icon: '', backgroundClassName: 'is-thailand' },
  { id: 'Cambodia', label: 'Cambodia', flag: '🇰🇭', icon: '', backgroundClassName: 'is-cambodia' },
  {
    id: 'Philippines',
    label: 'Philippines',
    flag: '🇵🇭',
    icon: '',
    backgroundClassName: 'is-philippines',
  },
  { id: 'Vietnam', label: 'Vietnam', flag: '🇻🇳', icon: '', backgroundClassName: 'is-vietnam' },
  {
    id: 'Singapore',
    label: 'Singapore',
    flag: '🇸🇬',
    icon: '',
    backgroundClassName: 'is-singapore',
  },
  { id: 'Myanmar', label: 'Myanmar', flag: '🇲🇲', icon: '', backgroundClassName: 'is-myanmar' },
];

const COMMUNITY_OPTIONS: Option[] = [
  { id: 'Tandia', label: 'Tandia', flag: '🇮🇩', icon: '', backgroundClassName: 'is-indonesia' },
  { id: 'Semai', label: 'Semai', flag: '🇲🇾', icon: '', backgroundClassName: 'is-malaysia' },
  { id: 'Mlabri', label: 'Mlabri', flag: '🇹🇭', icon: '', backgroundClassName: 'is-thailand' },
  { id: 'Chong', label: 'Chong', flag: '🇰🇭', icon: '', backgroundClassName: 'is-cambodia' },
  { id: 'Arta', label: 'Arta', flag: '🇵🇭', icon: '', backgroundClassName: 'is-philippines' },
  { id: 'Arem', label: 'Arem', flag: '🇻🇳', icon: '', backgroundClassName: 'is-vietnam' },
  { id: 'Kristang', label: 'Kristang', flag: '🇸🇬', icon: '', backgroundClassName: 'is-singapore' },
  { id: 'Moken', label: 'Moken', flag: '🇲🇲', icon: '', backgroundClassName: 'is-myanmar' },
];

const STEPS: OnboardingStep[] = [
  {
    key: 'purpose',
    title: 'Why did you join Taleka?',
    subtitle: 'Select one or more',
    kind: 'list',
    mode: 'multi',
    options: PURPOSE_OPTIONS,
  },
  {
    key: 'cultureConnection',
    title: 'What connects you most to culture?',
    subtitle: 'Select the themes that resonate with your heritage.',
    kind: 'list',
    mode: 'multi',
    options: CULTURE_OPTIONS,
  },
  {
    key: 'familiarity',
    title: 'How familiar are you with indigenous languages?',
    kind: 'list',
    mode: 'single',
    options: FAMILIARITY_OPTIONS,
  },
  {
    key: 'country',
    title: 'Which culture would you like to explore first?',
    subtitle: 'Select the methods that feel most natural to you. We will tailor your journey.',
    kind: 'cards',
    mode: 'single',
    options: COUNTRY_OPTIONS,
  },
  {
    key: 'languageCommunity',
    title: 'Choose a language community',
    subtitle: 'Select a community to explore their unique stories, heritage, and spoken word.',
    kind: 'cards',
    mode: 'single',
    options: COMMUNITY_OPTIONS,
  },
  {
    key: 'summary',
    title: 'Summary',
    kind: 'summary',
  },
];

const INITIAL_RESPONSES: OnboardingResponses = {
  purpose: ['learn-language', 'practice-semai'],
  cultureConnection: ['stories-folktales'],
  familiarity: 'new',
  country: 'Malaysia',
  languageCommunity: 'Semai',
};

const getOptionLabel = (options: Option[], id: string | null) =>
  options.find((option) => option.id === id)?.label ?? id ?? '';

const getSummaryFocusTitle = (id: string | null) => {
  if (id === 'stories-folktales') return 'Stories & Folklore';
  return getOptionLabel(CULTURE_OPTIONS, id);
};

const isResponseKey = (key: OnboardingStep['key']): key is keyof OnboardingResponses =>
  key !== 'summary';

const hasStepSelection = (step: OnboardingStep, responses: OnboardingResponses) => {
  if (!isResponseKey(step.key)) return true;
  const value = responses[step.key];
  return Array.isArray(value) ? value.length > 0 : Boolean(value);
};

export function OnboardingPage({ onCompleted }: OnboardingPageProps) {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [stepIndex, setStepIndex] = useState(0);
  const [responses, setResponses] = useState<OnboardingResponses>(INITIAL_RESPONSES);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const step = STEPS[stepIndex];
  const progressPercent = Math.round(((stepIndex + 1) / STEPS.length) * 100);
  const canContinue = hasStepSelection(step, responses) && !isSaving;
  const toggleOption = (optionId: string) => {
    if (!isResponseKey(step.key)) return;
    const responseKey = step.key;
    triggerHapticFeedback('light');

    setResponses((current) => {
      const currentValue = current[responseKey];
      if (step.mode === 'multi' && Array.isArray(currentValue)) {
        const exists = currentValue.includes(optionId);
        return {
          ...current,
          [responseKey]: exists
            ? currentValue.filter((id) => id !== optionId)
            : [...currentValue, optionId],
        };
      }

      return {
        ...current,
        [responseKey]: optionId,
      };
    });
  };

  const handleBack = () => {
    if (stepIndex === 0 || isSaving) return;
    triggerHapticFeedback('light');
    setStepIndex((current) => current - 1);
  };

  const handleContinue = async () => {
    if (!canContinue || !user?.id) return;
    triggerHapticFeedback('medium');

    if (stepIndex < STEPS.length - 1) {
      setStepIndex((current) => current + 1);
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await completeProfileOnboarding({ userId: user.id, responses });
      onCompleted?.();
      navigate('/home/landing', { replace: true });
    } catch (saveError) {
      console.error('Failed to complete onboarding:', saveError);
      setError('Could not save onboarding. Please try again.');
      triggerHapticFeedback('error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <IonPage>
      <IonContent fullscreen className="onboarding-content">
        <main className="onboarding-screen">
          <section className="onboarding-phone" aria-label="Taleka onboarding">
            <div
              className={`onboarding-hero onboarding-hero--${step.kind}`}
              style={{ '--onboarding-pattern': `url(${authTopPattern})` } as CSSProperties}
            >
              <div
                className="onboarding-progress"
                aria-label={`Step ${stepIndex + 1} of ${STEPS.length}`}
              >
                <span style={{ width: `${progressPercent}%` }} />
              </div>

              <button
                type="button"
                className="onboarding-back"
                onClick={handleBack}
                disabled={stepIndex === 0 || isSaving}
                aria-label="Back"
              >
                <IonIcon aria-hidden icon={chevronBackOutline} />
              </button>

              <div className="onboarding-heading">
                <h1>{step.title}</h1>
                {step.subtitle ? <p>{step.subtitle}</p> : null}
              </div>
            </div>

            <div className={`onboarding-panel onboarding-panel--${step.kind}`}>
              {step.kind === 'summary' ? (
                <div className="onboarding-summary">
                  <div className="onboarding-summary-spark" aria-hidden="true">
                    <IonIcon icon={sparklesOutline} />
                  </div>
                  <SummaryItem
                    flag="🇲🇾"
                    title={responses.country ?? 'Malaysia'}
                    label="Country of Focus"
                  />
                  <SummaryItem
                    icon={leafOutline}
                    title={`${responses.languageCommunity ?? 'Semai'} Language`}
                    label="Language Path"
                  />
                  <SummaryItem
                    icon={bookOutline}
                    title={getSummaryFocusTitle(responses.cultureConnection[0] ?? null)}
                    label="Focus Area"
                  />
                </div>
              ) : step.kind === 'cards' ? (
                <div className="onboarding-card-grid">
                  {step.options?.map((option) => {
                    const selected = isResponseKey(step.key) && responses[step.key] === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        className={`onboarding-country-card ${selected ? 'is-selected' : ''} ${option.backgroundClassName ?? ''}`}
                        onClick={() => toggleOption(option.id)}
                        aria-pressed={selected}
                      >
                        <span className="onboarding-flag">{option.flag}</span>
                        <span>{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="onboarding-option-list">
                  {step.options?.map((option) => {
                    const value = isResponseKey(step.key) ? responses[step.key] : null;
                    const selected = Array.isArray(value)
                      ? value.includes(option.id)
                      : value === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        className={`onboarding-option ${selected ? 'is-selected' : ''} ${option.description ? 'has-description' : ''}`}
                        onClick={() => toggleOption(option.id)}
                        aria-pressed={selected}
                      >
                        <span className="onboarding-option-icon">
                          <IonIcon aria-hidden icon={option.icon} />
                        </span>
                        <span className="onboarding-option-copy">
                          <strong>{option.label}</strong>
                          {option.description ? <small>{option.description}</small> : null}
                        </span>
                        <span className="onboarding-check" aria-hidden="true">
                          {selected ? '✓' : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="onboarding-actions">
                <button
                  type="button"
                  className="onboarding-continue"
                  onClick={handleContinue}
                  disabled={!canContinue}
                >
                  <span>
                    {step.kind === 'summary' ? (isSaving ? 'Saving...' : 'Continue') : 'Continue'}
                  </span>
                  <span aria-hidden="true">→</span>
                </button>
              </div>
            </div>
          </section>
        </main>

        <IonToast
          isOpen={Boolean(error)}
          message={error ?? ''}
          duration={3200}
          color="danger"
          onDidDismiss={() => setError(null)}
        />
      </IonContent>
    </IonPage>
  );
}

function SummaryItem({
  icon,
  flag,
  title,
  label,
}: {
  icon?: string;
  flag?: string;
  title: string;
  label: string;
}) {
  return (
    <article className="onboarding-summary-item">
      <span className="onboarding-summary-icon">
        {flag ? <span>{flag}</span> : <IonIcon aria-hidden icon={icon} />}
      </span>
      <span>
        <strong>{title}</strong>
        <small>{label}</small>
      </span>
    </article>
  );
}
