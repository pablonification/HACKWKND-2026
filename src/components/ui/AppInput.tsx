import { IonInput, IonItem, IonLabel, IonNote } from '@ionic/react';
import type { ComponentProps } from 'react';

type IonInputProps = ComponentProps<typeof IonInput>;

type AppInputProps = IonInputProps & {
  label?: string;
  error?: string | null;
};

export function AppInput({ label, error, ...props }: AppInputProps) {
  return (
    <IonItem className={error ? 'ion-invalid' : ''}>
      {label && <IonLabel position="stacked">{label}</IonLabel>}
      <IonInput {...props} />
      {error && <IonNote slot="error">{error}</IonNote>}
    </IonItem>
  );
}
