import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { GROUPS, TERMS, type Term } from '@/data/glossary';
import { markTerm, useStore } from '@/lib/store';
import { watchBadges } from '@/ui/celebrate';
import { C, Empty, Icon, Page, Row, SearchField, Txt } from '@/ui/kit';

/** Every investing word in the app, explained at two reading levels. Tap a word to open it. */
export default function Glossary() {
  const { learned, settings } = useStore();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const q = query.trim().toLowerCase();
  const match = (t: Term) => !q || t.word.toLowerCase().includes(q) || t.simple.toLowerCase().includes(q);
  const simpleFirst = settings.level === 'simple';

  const toggle = (t: Term) => {
    setMore(false);
    if (open === t.id) return setOpen(null);
    setOpen(t.id);
    const celebrate = watchBadges();
    markTerm(t.id);
    celebrate();
  };

  return (
    <Page gap={10}>
      <SearchField placeholder="Search for a word" value={query} onChangeText={setQuery} accessibilityLabel="Search the glossary" />
      {!TERMS.some(match) && <Empty icon="search" title="No words match" body="Try a shorter word." />}
      {GROUPS.map((g) => {
        const terms = TERMS.filter((t) => t.group === g && match(t));
        if (!terms.length) return null;
        return (
          <View key={g} style={{ gap: 8, marginTop: 6 }}>
            <Txt size={17} bold>{g}</Txt>
            {terms.map((t) => {
              const isOpen = open === t.id;
              const read = learned.terms.includes(t.id);
              return (
                <Pressable key={t.id} accessibilityRole="button" accessibilityLabel={`Word ${t.word}`} onPress={() => toggle(t)}
                  style={{ backgroundColor: C.card, borderRadius: 14, padding: 14, gap: 8, borderWidth: 1, borderColor: isOpen ? C.accent : C.card }}>
                  <Row>
                    <Txt size={16} bold style={{ flex: 1 }}>{t.word}</Txt>
                    {read && <Icon name="checkmark-circle" size={18} color={C.accent} />}
                    <Icon name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={C.muted} />
                  </Row>
                  {isOpen && (
                    <>
                      <Txt size={15}>{simpleFirst ? t.simple : t.detailed}</Txt>
                      {more && <Txt size={15} color={C.muted}>{simpleFirst ? t.detailed : t.simple}</Txt>}
                      {!more && (
                        <Pressable accessibilityRole="button" accessibilityLabel={simpleFirst ? 'Tell me more' : 'Say it simply'} onPress={() => setMore(true)} hitSlop={8}>
                          <Txt size={14} color={C.accent}>{simpleFirst ? 'Tell me more' : 'Say it simply'}</Txt>
                        </Pressable>
                      )}
                    </>
                  )}
                </Pressable>
              );
            })}
          </View>
        );
      })}
    </Page>
  );
}
