import './TalekaWordmark.css';

type TalekaWordmarkProps = {
  className?: string;
};

export function TalekaWordmark({ className }: TalekaWordmarkProps) {
  return (
    <div className={['taleka-wordmark', className].filter(Boolean).join(' ')} aria-label="Taleka">
      <span className="taleka-wordmark-initial">T</span>
      <span className="taleka-wordmark-rest">aleka</span>
    </div>
  );
}
