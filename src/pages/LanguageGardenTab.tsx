import { useState } from 'react';
import { IonToast } from '@ionic/react';
import { useNavigate } from 'react-router-dom';

import { triggerHapticFeedback } from '../lib/feedback';

import wordleImg from '../../assets/garden/wordle.png';
import vocabMasterImg from '../../assets/garden/vocab-master.png';
import quizImg from '../../assets/garden/quiz.png';
import ilustrationBg from '../../assets/garden/background.png';

import './LanguageGardenTab.css';

const GAME_CARDS = [
  {
    id: 'wordle',
    label: 'Wordle',
    image: wordleImg,
    alt: 'Wordle — Semai word guessing game',
  },
  {
    id: 'vocab',
    label: 'Vocab Master',
    image: vocabMasterImg,
    alt: 'Vocab Master — vocabulary flashcard game',
  },
  {
    id: 'quiz',
    label: 'Quiz',
    image: quizImg,
    alt: 'Quiz — language knowledge quiz',
  },
] as const;

export function LanguageGardenTab() {
  const navigate = useNavigate();
  const [toastOpen, setToastOpen] = useState(false);

  const handleCardTap = (id: string) => {
    triggerHapticFeedback('light');
    if (id === 'quiz') {
      navigate('/home/garden/quiz');
    } else if (id === 'vocab') {
      navigate('/home/garden/vocab');
    } else if (id === 'wordle') {
      navigate('/home/garden/wordle');
    } else {
      setToastOpen(true);
    }
  };

  return (
    <section className="garden-shell">
      <header className="garden-header">
        <h1 className="garden-title">Garden</h1>
        <p className="garden-subtitle">What do you want to play today?</p>
      </header>

      <ul className="garden-cards" role="list">
        {GAME_CARDS.map((card) => (
          <li key={card.id}>
            <button
              type="button"
              className="garden-card"
              onClick={() => handleCardTap(card.id)}
              aria-label={`Play ${card.label}`}
            >
              <img
                src={card.image}
                alt={card.alt}
                className="garden-card-image"
                draggable={false}
              />
            </button>
          </li>
        ))}
      </ul>

      <div className="garden-bg-illustration" aria-hidden="true">
        <img src={ilustrationBg} alt="" draggable={false} />
      </div>

      <IonToast
        isOpen={toastOpen}
        message="Coming soon! 🌱"
        duration={2000}
        color="success"
        onDidDismiss={() => setToastOpen(false)}
      />
    </section>
  );
}
