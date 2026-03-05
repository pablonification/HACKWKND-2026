import { IonIcon, IonToast } from '@ionic/react';
import {
  arrowBackOutline,
  chevronDownOutline,
  swapHorizontal,
  volumeMediumOutline,
} from 'ionicons/icons';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { triggerHapticFeedback } from '../lib/feedback';
import { type TranslationLanguage, translateText } from '../lib/translate';

import './TranslatePage.css';

type LanguageOption = {
  value: TranslationLanguage;
  label: string;
};

const LANGUAGE_OPTIONS: LanguageOption[] = [
  { value: 'semai', label: 'Semai' },
  { value: 'ms', label: 'Malay' },
  { value: 'en', label: 'English' },
];

const VOICE_LANGUAGE_MAP: Record<TranslationLanguage, string> = {
  semai: 'ms-MY',
  ms: 'ms-MY',
  en: 'en-US',
};

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return 'Something went wrong while translating.';
};

export function TranslatePage() {
  const navigate = useNavigate();

  const [sourceText, setSourceText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [sourceLanguage, setSourceLanguage] = useState<TranslationLanguage>('semai');
  const [targetLanguage, setTargetLanguage] = useState<TranslationLanguage>('en');
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(
    () => () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    },
    [],
  );

  const translateButtonLabel = useMemo(
    () => (isTranslating ? 'Translating...' : 'Translate'),
    [isTranslating],
  );

  const handleBack = () => {
    triggerHapticFeedback('light');
    navigate('/home/garden', { replace: true });
  };

  const handleSourceTextChange = (value: string) => {
    setSourceText(value);
    if (translatedText) {
      setTranslatedText('');
    }
  };

  const handleSourceLanguageChange = (nextLanguage: TranslationLanguage) => {
    if (nextLanguage === sourceLanguage) {
      return;
    }

    const previousSourceLanguage = sourceLanguage;
    setSourceLanguage(nextLanguage);

    if (nextLanguage === targetLanguage) {
      setTargetLanguage(previousSourceLanguage);
    }

    setNotice(null);
    triggerHapticFeedback('light');
  };

  const handleTargetLanguageChange = (nextLanguage: TranslationLanguage) => {
    if (nextLanguage === targetLanguage) {
      return;
    }

    const previousTargetLanguage = targetLanguage;
    setTargetLanguage(nextLanguage);

    if (nextLanguage === sourceLanguage) {
      setSourceLanguage(previousTargetLanguage);
    }

    setNotice(null);
    triggerHapticFeedback('light');
  };

  const handleSwapLanguages = () => {
    if (isTranslating) {
      return;
    }

    const nextSourceLanguage = targetLanguage;
    const nextTargetLanguage = sourceLanguage;
    const nextSourceText = translatedText;
    const nextTranslatedText = sourceText;

    setSourceLanguage(nextSourceLanguage);
    setTargetLanguage(nextTargetLanguage);
    setSourceText(nextSourceText);
    setTranslatedText(nextTranslatedText);
    setNotice(null);

    triggerHapticFeedback('medium');
  };

  const handleSpeak = (text: string, language: TranslationLanguage) => {
    const cleanText = text.trim();
    if (!cleanText) {
      setError('There is no text to play yet.');
      triggerHapticFeedback('error');
      return;
    }

    if (!('speechSynthesis' in window)) {
      setError('Audio playback is not available on this device.');
      triggerHapticFeedback('error');
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = VOICE_LANGUAGE_MAP[language];
    utterance.rate = 0.95;
    utterance.pitch = 1;

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    triggerHapticFeedback('light');
  };

  const handleTranslate = async () => {
    const normalized = sourceText.trim();
    if (!normalized) {
      setError('Enter text before translating.');
      triggerHapticFeedback('error');
      return;
    }

    setIsTranslating(true);
    setError(null);
    setNotice(null);
    triggerHapticFeedback('medium');

    try {
      const result = await translateText({
        text: normalized,
        from: sourceLanguage,
        to: targetLanguage,
      });

      setTranslatedText(result.translatedText);
      if (result.warning) {
        setNotice(result.warning);
      }
      triggerHapticFeedback('success');
    } catch (translationError) {
      setError(toErrorMessage(translationError));
      triggerHapticFeedback('error');
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <section className="translate-page">
      <header className="translate-header">
        <button type="button" className="translate-back" onClick={handleBack} aria-label="Back">
          <IonIcon icon={arrowBackOutline} />
        </button>
        <h1>Translation</h1>
      </header>

      <div className="translate-panel">
        <article className="translate-card">
          <label className="translate-sr-only" htmlFor="translate-source-input">
            Source text
          </label>
          <textarea
            id="translate-source-input"
            className="translate-textarea"
            value={sourceText}
            onChange={(event) => handleSourceTextChange(event.target.value)}
            placeholder="Type in Semai, Malay, or English..."
            disabled={isTranslating}
          />
          <button
            type="button"
            className="translate-speak"
            onClick={() => handleSpeak(sourceText, sourceLanguage)}
            aria-label="Listen to source text"
          >
            <IonIcon icon={volumeMediumOutline} />
          </button>
        </article>

        <div className="translate-language-row">
          <label className="translate-language">
            <span className="translate-sr-only">Source language</span>
            <select
              value={sourceLanguage}
              onChange={(event) =>
                handleSourceLanguageChange(event.target.value as TranslationLanguage)
              }
              disabled={isTranslating}
              aria-label="Source language"
            >
              {LANGUAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <IonIcon icon={chevronDownOutline} aria-hidden="true" />
          </label>

          <button
            type="button"
            className="translate-swap"
            onClick={handleSwapLanguages}
            disabled={isTranslating}
            aria-label="Swap translation languages"
          >
            <IonIcon icon={swapHorizontal} />
          </button>

          <label className="translate-language">
            <span className="translate-sr-only">Target language</span>
            <select
              value={targetLanguage}
              onChange={(event) =>
                handleTargetLanguageChange(event.target.value as TranslationLanguage)
              }
              disabled={isTranslating}
              aria-label="Target language"
            >
              {LANGUAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <IonIcon icon={chevronDownOutline} aria-hidden="true" />
          </label>
        </div>

        <article className="translate-card">
          <label className="translate-sr-only" htmlFor="translate-result-output">
            Translation result
          </label>
          <textarea
            id="translate-result-output"
            className="translate-textarea translate-textarea-output"
            value={translatedText}
            readOnly
            placeholder="Your translation appears here."
          />
          <button
            type="button"
            className="translate-speak"
            onClick={() => handleSpeak(translatedText, targetLanguage)}
            aria-label="Listen to translated text"
          >
            <IonIcon icon={volumeMediumOutline} />
          </button>
        </article>

        <button
          type="button"
          className="translate-submit"
          onClick={() => void handleTranslate()}
          disabled={isTranslating}
        >
          {translateButtonLabel}
        </button>
      </div>

      <IonToast
        isOpen={Boolean(error)}
        message={error ?? ''}
        duration={3200}
        color="danger"
        onDidDismiss={() => setError(null)}
      />
      <IonToast
        isOpen={Boolean(notice)}
        message={notice ?? ''}
        duration={2600}
        color="medium"
        onDidDismiss={() => setNotice(null)}
      />
    </section>
  );
}
