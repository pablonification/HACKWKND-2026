import { IonButton, IonSpinner } from '@ionic/react';
import type { ComponentProps } from 'react';

type IonButtonProps = ComponentProps<typeof IonButton>;

type AppButtonProps = IonButtonProps & {
  loading?: boolean;
};

export function AppButton({ loading = false, disabled, children, ...props }: AppButtonProps) {
  return (
    <IonButton disabled={disabled ?? loading} {...props}>
      {loading ? <IonSpinner name="crescent" /> : children}
    </IonButton>
  );
}
