import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { ACCENTS, DEFAULT_ACCENT } from '@/lib/theme';
import { exportBackup, importBackup, setAccent, setName, setSetting, setUnit, useStore } from '@/lib/store';
import { Btn, C, Caption, Card, Divider, Icon, Page, Row, Txt, type IconName } from '@/ui/kit';
import { alertBox, pick, prompt, toast } from '@/ui/overlay';

const RESTS = [0, 60, 90, 120, 150, 180, 240];
const restLabel = (s: number) => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : 'Off');

/** Profile, workout preferences, units, theme, integrations and your data. */
export default function Settings() {
  const router = useRouter();
  const { settings, workouts, routines, measures } = useStore();
  const accent = settings.accent ?? DEFAULT_ACCENT;

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
  const rename = async () => {
    const name = await prompt('Your name', settings.name, 'Name');
    if (name !== null) setName(name);
  };
  const rest = async () => {
    const v = await pick('Default rest timer', RESTS, settings.default_rest ?? 0, restLabel);
    if (v !== null) setSetting('default_rest', v);
  };

  const row = (icon: IconName, title: string, value: string, onPress: () => void) => (
    <View key={title}>
      <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 54, opacity: pressed ? 0.6 : 1 })}>
        <Icon name={icon} size={22} />
        <Txt size={16} style={{ flex: 1 }}>{title}</Txt>
        {!!value && <Txt size={15} color={C.muted}>{value}</Txt>}
        <Icon name="chevron-forward" size={18} color={C.muted} />
      </Pressable>
      <Divider />
    </View>
  );
  const two = <T extends string>(options: readonly T[], current: T, set: (v: T) => void) => (
    <Row>{options.map((o) => <Btn key={o} title={o} kind={current === o ? 'primary' : 'ghost'} style={{ flex: 1 }} height={44} onPress={() => set(o)} />)}</Row>
  );

  return (
    <Page>
      <Txt size={18} bold>Profile</Txt>
      <View>{row('person-outline', 'Name', settings.name || 'Not set', rename)}</View>

      <Txt size={18} bold>Workouts</Txt>
      <View>
        {row('timer-outline', 'Default rest timer', restLabel(settings.default_rest ?? 0), rest)}
        {row('shield-checkmark-outline', 'Check unusual entries', settings.check_entries === false ? 'Off' : 'On', () => setSetting('check_entries', settings.check_entries === false))}
      </View>
      <Txt size={13} color={C.muted}>The check asks before saving a set far outside your history, like 153 reps where you usually do 15.</Txt>

      <Txt size={18} bold>Units</Txt>
      <Card>
        <Caption>Weight</Caption>
        {two(['lb', 'kg'] as const, settings.unit, setUnit)}
        <Caption>Body measurements</Caption>
        {two(['cm', 'in'] as const, settings.length_unit ?? 'cm', (v) => setSetting('length_unit', v))}
        <Txt size={13} color={C.muted}>Your logged numbers are converted, not changed.</Txt>
      </Card>

      <Txt size={18} bold>Theme</Txt>
      <Card>
        <Row gap={12} style={{ flexWrap: 'wrap' }}>
          {(Object.keys(ACCENTS) as (keyof typeof ACCENTS)[]).map((name) => (
            <Pressable key={name} accessibilityRole="button" accessibilityLabel={`${name} theme`} accessibilityState={{ selected: name === accent }} onPress={() => { if (name !== accent) setAccent(name); }} style={{ alignItems: 'center', gap: 6, width: 58 }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: ACCENTS[name].accent, borderWidth: 3, borderColor: name === accent ? C.text : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                {name === accent && <Icon name="checkmark" size={20} color={ACCENTS[name].onAccent} />}
              </View>
              <Txt size={12} color={name === accent ? C.text : C.muted}>{name}</Txt>
            </Pressable>
          ))}
        </Row>
      </Card>

      <Txt size={18} bold>Integrations</Txt>
      <View>{row('link-outline', 'Integrations', 'Claude, ChatGPT, Health Connect', () => router.push('/integrations'))}</View>

      <Txt size={18} bold>Your data</Txt>
      <Txt size={14} color={C.muted}>Everything is stored on this phone: {workouts.length} workouts, {routines.length} routines, {measures.length} measurements.</Txt>
      <View>
        {row('download-outline', 'Import from Hevy', '', () => router.push('/import'))}
        {row('copy-outline', 'Copy backup to clipboard', '', backup)}
        {row('refresh-outline', 'Restore from a backup', '', restore)}
      </View>

      <Txt size={13} color={C.muted}>Reps 1.3 · Exercise library, photos and instructions from free-exercise-db (public domain).</Txt>
    </Page>
  );
}
