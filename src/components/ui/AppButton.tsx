import { IonButton } from '@ionic/react';
import type { ComponentProps } from 'react';
import { AppSkeleton } from './AppSkeleton';

type IonButtonProps = ComponentProps<typeof IonButton>;

type AppButtonProps = IonButtonProps & {
  loading?: boolean;
};

export function AppButton({ loading = false, disabled, children, ...props }: AppButtonProps) {
  return (
    <IonButton disabled={disabled ?? loading} {...props}>
      {loading ? <AppSkeleton className="app-skeleton--pill" width={72} height={16} /> : children}
    </IonButton>
  );
}
