import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform } from 'react-native';

import { fmtDate, plural } from '@/lib/format';
import { importHevy, type ImportResult } from '@/lib/hevy';
import { Btn, C, Caption, Card, Page, Txt } from '@/ui/kit';
import { alertBox } from '@/ui/overlay';

/** Brings workout history and body measurements across from Hevy's CSV export. */
export default function ImportHevy() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<ImportResult[]>([]);

  const choose = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'text/plain', '*/*'], copyToCacheDirectory: true, multiple: true });
    if (res.canceled || !res.assets?.length) return;
    setBusy(true);
    await new Promise((r) => setTimeout(r, 50)); // let the spinner show before the heavy work
    const out: ImportResult[] = [];
    for (const a of res.assets) {
      try {
        const text = Platform.OS === 'web' ? await (await fetch(a.uri)).text() : await new File(a.uri).text();
        out.push(importHevy(text));
      } catch {
        alertBox(`Couldn't read ${a.name}`, 'Choose workout_data.csv or measurement_data.csv exactly as Hevy exported them.');
      }
    }
    setDone((d) => [...d, ...out]);
    setBusy(false);
  };

  return (
    <Page>
      <Card>
        <Caption>How it works</Caption>
        <Txt size={15}>1. In Hevy, open Settings, then Export and Import Data, and export your workouts (and measurements if you track them).</Txt>
        <Txt size={15}>2. Choose the CSV files here. You can pick both at once.</Txt>
        <Txt size={13} color={C.muted}>Everything stays on this phone. Exercises that match the Reps library are linked to it; the rest keep your names as custom exercises. Importing the same file twice adds nothing.</Txt>
      </Card>
      <Btn title="Choose CSV files" icon="document-outline" busy={busy} onPress={choose} />
      {done.map((r, i) => (
        <Card key={i} style={{ borderWidth: 1, borderColor: C.good }}>
          <Caption>{r.kind === 'workouts' ? 'Workouts imported' : 'Measurements imported'}</Caption>
          <Txt size={19} bold>{r.kind === 'workouts' ? plural(r.added, 'workout') : plural(r.added, 'entry').replace('entrys', 'entries')} added</Txt>
          {r.kind === 'workouts' && r.added > 0 && (
            <>
              {!!r.first && !!r.last && <Txt size={14} color={C.muted}>{fmtDate(r.first)} to {fmtDate(r.last)}</Txt>}
              <Txt size={15}>{plural(r.matched, 'exercise')} matched the library, {r.custom} kept as custom.</Txt>
              {r.routines > 0 && <Txt size={15}>{plural(r.routines, 'routine')} rebuilt from your last 6 weeks, in the folder "From Hevy".</Txt>}
              <Txt size={13} color={C.muted}>Records were recalculated across your whole history.</Txt>
            </>
          )}
          {r.skipped > 0 && <Txt size={13} color={C.muted}>{r.skipped} already here or empty, skipped.</Txt>}
        </Card>
      ))}
      {done.some((r) => r.added > 0) && <Btn title="Open Coach" kind="ghost" onPress={() => router.replace('/coach')} />}
    </Page>
  );
}
