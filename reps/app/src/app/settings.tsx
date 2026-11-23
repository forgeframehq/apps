import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';

import { exportBackup, importBackup, isLinked, setUnit, useStore } from '@/lib/store';
import { Btn, C, Caption, Card, Page, Row, Txt } from '@/ui/kit';
import { alertBox, prompt, toast } from '@/ui/overlay';

/** Units, backup and restore. */
export default function Settings() {
  const router = useRouter();
  const { settings, workouts, routines } = useStore();

  const backup = async () => {
    await Clipboard.setStringAsync(exportBackup());
    toast('Backup copied. Paste it somewhere safe.');
  };
  const restore = async () => {
    const text = await prompt('Restore from a backup', '', 'Paste the backup text here', { okText: 'Restore', multiline: true });
    if (!text?.trim()) return;
    try {
      const added = importBackup(text);
      toast(added ? `Added ${added} workout${added === 1 ? '' : 's'} from the backup` : 'Nothing new in that backup');
    } catch {
      alertBox("Couldn't read that backup", 'Paste the whole text exactly as it was copied from Reps or ForgeLift.');
    }
  };

  return (
    <Page>
      <Card>
        <Caption>Weight unit</Caption>
        <Row>{(['lb', 'kg'] as const).map((u) => <Btn key={u} title={u} kind={settings.unit === u ? 'primary' : 'ghost'} style={{ flex: 1 }} onPress={() => setUnit(u)} />)}</Row>
        <Txt size={13} color={C.muted}>Your logged weights are converted, not changed.</Txt>
      </Card>
      <Card>
        <Caption>Your data</Caption>
        <Txt size={15}>Everything is stored on this phone: {workouts.length} workouts, {routines.length} routines.</Txt>
        <Btn title="Copy backup to clipboard" kind="ghost" icon="copy-outline" onPress={backup} />
        <Btn title="Restore from a backup" kind="ghost" icon="download-outline" onPress={restore} />
      </Card>
      <Card>
        <Caption>Connectors</Caption>
        <Txt size={15}>{isLinked() ? 'Claude is connected.' : 'Optional: connect Claude to coach, plan and log for you.'}</Txt>
        <Btn title="Open Connectors" kind="ghost" icon="extension-puzzle-outline" onPress={() => router.push('/connectors')} />
      </Card>
      <Card style={{ gap: 6 }}>
        <Caption>About</Caption>
        <Txt size={15}>Reps 1.0</Txt>
        <Txt size={13} color={C.muted}>Exercise library, photos and instructions from free-exercise-db (public domain).</Txt>
      </Card>
    </Page>
  );
}
