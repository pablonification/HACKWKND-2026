import {
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
} from '@ionic/react';
import type { ComponentProps, ReactNode } from 'react';

type IonCardProps = ComponentProps<typeof IonCard>;

type AppCardProps = IonCardProps & {
  title?: string;
  subtitle?: string;
  children: ReactNode;
};

export function AppCard({ title, subtitle, children, ...props }: AppCardProps) {
  const hasHeader = Boolean(title ?? subtitle);
  return (
    <IonCard {...props}>
      {hasHeader && (
        <IonCardHeader>
          {title && <IonCardTitle>{title}</IonCardTitle>}
          {subtitle && <IonCardSubtitle>{subtitle}</IonCardSubtitle>}
        </IonCardHeader>
      )}
      <IonCardContent>{children}</IonCardContent>
    </IonCard>
  );
}
