import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { addFolder, deleteFolder, deleteRoutine, duplicateRoutine, folders, isLinked, renameFolder, saveRoutine, startWorkout, useStore } from '@/lib/store';
import { syncNow } from '@/lib/sync';
import type { Routine } from '@/lib/types';
import { Btn, C, Card, Empty, Icon, IconBtn, Page, Row, TabHeader, TapCard, Txt } from '@/ui/kit';
import { MiniBar } from '@/ui/minibar';
import { alertBox, confirm, menu, pick, prompt, toast } from '@/ui/overlay';

/** Workout tab: quick start, routines and folders. */
export default function WorkoutTab() {
  const router = useRouter();
  const { routines, active, syncing } = useStore();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const linked = isLinked();
  const folderList = folders();

  const begin = async (r?: Routine) => {
    if (active && !(await confirm('Workout in progress', 'Starting a new one discards the workout you have open.', 'Discard and start', { danger: true, cancelText: 'Keep current' }))) return;
    startWorkout(r);
    router.push('/session');
  };
  const edit = (id: string, folder = '') => router.push(`/routine/${id || 'new'}${folder ? `?folder=${encodeURIComponent(folder)}` : ''}`);

  const newFolder = async () => {
    const name = await prompt('New folder', '', 'e.g. Push Pull Legs', { okText: 'Create' });
    if (name?.trim()) addFolder(name);
  };
  const folderMenu = async (f: string) => {
    const i = await menu(f, [{ label: 'New routine in this folder', icon: 'add' }, { label: 'Rename folder', icon: 'pencil' }, { label: 'Delete folder', icon: 'trash-outline', danger: true }]);
    if (i === 0) edit('', f);
    if (i === 1) {
      const name = await prompt('Rename folder', f);
      if (name) renameFolder(f, name);
    }
    if (i === 2 && (await confirm('Delete folder?', 'Its routines are kept and move out of the folder.', 'Delete folder', { danger: true }))) deleteFolder(f);
  };
  const routineMenu = async (r: Routine) => {
    const i = await menu(r.name, [{ label: 'Edit routine', icon: 'pencil' }, { label: 'Duplicate', icon: 'copy-outline' }, { label: 'Move to folder', icon: 'folder-outline' }, { label: 'Delete routine', icon: 'trash-outline', danger: true }]);
    if (i === 0) edit(r.id);
    if (i === 1) duplicateRoutine(r.id);
    if (i === 2) {
      const f = await pick('Move to folder', ['', ...folders()], r.folder, (o) => o || 'No folder');
      if (f !== null) saveRoutine({ ...r, folder: f });
    }
    if (i === 3 && (await confirm('Delete routine?', 'Workouts you already logged stay in your history.', 'Delete routine', { danger: true }))) deleteRoutine(r.id);
  };
  const askClaude = async () => {
    if (linked) return alertBox('Ask Claude', 'In Claude, try: "Build me a 4-day upper/lower split and save it to Reps." New routines appear here after the next sync.');
    if (await confirm('Connect Claude', 'Claude can read your history, write routines and log workouts once you connect it. The app works fully without it.', 'Set it up', { cancelText: 'Not now' })) router.push('/connectors');
  };
  const sync = async () => {
    const r = await syncNow();
    toast(r.ok ? 'Synced with Claude' : `Sync failed: ${r.error}`);
  };

  const card = (r: Routine) => (
    <Card key={r.id} style={{ gap: 8 }}>
      <Row>
        <Txt size={19} bold lines={1} style={{ flex: 1 }}>{r.name}</Txt>
        <IconBtn name="ellipsis-horizontal" label={`Options for ${r.name}`} side={36} size={22} onPress={() => routineMenu(r)} />
      </Row>
      <Txt size={15} color={C.muted} lines={2}>{r.exercises.map((e) => e.exercise_name).join(', ') || 'No exercises yet'}</Txt>
      <Btn title="Start Routine" disabled={!r.exercises.length} onPress={() => begin(r)} style={{ marginTop: 2 }} />
    </Card>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TabHeader title="Workout">
        {linked && <IconBtn name="sync" label="Sync with Claude" color={syncing ? C.muted : C.text} disabled={syncing} onPress={sync} />}
      </TabHeader>
      <Page>
        <Btn title="Start Empty Workout" kind="card" icon="add" left height={58} onPress={() => begin()} />
        <Row>
          <Txt size={20} bold style={{ flex: 1 }}>Routines</Txt>
          <IconBtn name="folder-open-outline" label="New folder" onPress={newFolder} />
        </Row>
        <Row gap={12}>
          <Btn title="New Routine" kind="card" icon="clipboard-outline" left height={56} style={{ flex: 1 }} onPress={() => edit('')} />
          <Btn title="Ask Claude" kind="card" icon="sparkles-outline" left height={56} style={{ flex: 1 }} onPress={askClaude} />
        </Row>
        {routines.length === 0 && folderList.length === 0 && (
          <Empty icon="clipboard-outline" title="No routines yet" body="Build one with New Routine, or connect Claude and ask it to write a program for you." />
        )}
        {routines.filter((r) => !r.folder).map(card)}
        {folderList.map((f) => {
          const mine = routines.filter((r) => r.folder === f);
          const open = !collapsed[f];
          return (
            <View key={f} style={{ gap: 14 }}>
              <Row gap={4}>
                <TapCard bare label={`${open ? 'Collapse' : 'Expand'} ${f}`} onPress={() => setCollapsed((c) => ({ ...c, [f]: open }))} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 40 }}>
                  <Icon name={open ? 'caret-down' : 'caret-forward'} size={14} color={C.muted} />
                  <Txt color={C.muted} lines={1} style={{ flex: 1 }}>{f} ({mine.length})</Txt>
                </TapCard>
                <IconBtn name="ellipsis-horizontal" label={`Options for folder ${f}`} side={40} size={22} onPress={() => folderMenu(f)} />
              </Row>
              {open && mine.map(card)}
            </View>
          );
        })}
      </Page>
      <MiniBar />
    </View>
  );
}
