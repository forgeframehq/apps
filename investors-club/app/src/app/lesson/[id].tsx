import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { lesson } from '@/data/lessons';
import { finishLesson } from '@/lib/store';
import { watchBadges } from '@/ui/celebrate';
import { Bar, Btn, C, Card, Empty, Icon, Page, Row, Txt } from '@/ui/kit';

/** A lesson: a few cards to read, then a quiz. */
export default function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const l = lesson(String(id));
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  if (!l) return <Empty icon="help-circle-outline" title="Lesson not found" body="Go back and choose a lesson." />;

  const total = l.cards.length + l.quiz.length;
  const done = step >= total;
  const card = step < l.cards.length ? l.cards[step] : null;
  const question = !card && !done ? l.quiz[step - l.cards.length] : null;

  const next = async () => {
    const right = question && picked === question.answer ? 1 : 0;
    const newScore = score + right;
    setScore(newScore);
    setPicked(null);
    setStep(step + 1);
    if (step + 1 >= total) {
      const celebrate = watchBadges();
      finishLesson(l.id, newScore);
      await celebrate();
    }
  };
  const again = () => { setStep(0); setScore(0); setPicked(null); };

  return (
    <Page>
      <Stack.Screen options={{ title: l.title }} />
      <Bar value={Math.min(step, total) / total} height={6} />

      {card && (
        <>
          <Card style={{ gap: 12, paddingVertical: 22 }}>
            <Txt size={13} color={C.muted}>{step + 1} of {l.cards.length}</Txt>
            <Txt size={22} bold>{card.title}</Txt>
            <Txt size={17}>{card.body}</Txt>
          </Card>
          <Row>
            {step > 0 && <Btn title="Back" kind="ghost" style={{ flex: 1 }} onPress={() => setStep(step - 1)} />}
            <Btn title={step === l.cards.length - 1 ? 'Start the quiz' : 'Next'} style={{ flex: 2 }} onPress={() => setStep(step + 1)} />
          </Row>
        </>
      )}

      {question && (
        <>
          <Txt size={13} color={C.muted}>Question {step - l.cards.length + 1} of {l.quiz.length}</Txt>
          <Txt size={20} bold>{question.q}</Txt>
          {question.options.map((o, i) => {
            const answered = picked !== null;
            const right = i === question.answer;
            const colour = !answered ? C.card : right ? C.goodDim : i === picked ? '#3A1514' : C.card;
            const edge = !answered ? C.card : right ? C.good : i === picked ? C.bad : C.card;
            return (
              <Pressable key={o} accessibilityRole="button" accessibilityLabel={`Answer ${i + 1}`} disabled={answered} onPress={() => setPicked(i)}
                style={({ pressed }) => ({ backgroundColor: colour, borderColor: edge, borderWidth: 1.5, borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 10, opacity: pressed ? 0.7 : 1 })}>
                <Txt size={16} style={{ flex: 1 }}>{o}</Txt>
                {answered && right && <Icon name="checkmark-circle" color={C.good} />}
                {answered && !right && i === picked && <Icon name="close-circle" color={C.bad} />}
              </Pressable>
            );
          })}
          {picked !== null && (
            <>
              <Card>
                <Txt size={16} bold color={picked === question.answer ? C.good : C.bad}>{picked === question.answer ? 'Correct' : 'Not quite'}</Txt>
                <Txt size={15} color={C.muted}>{question.why}</Txt>
              </Card>
              <Btn title={step === total - 1 ? 'See my score' : 'Next question'} onPress={next} />
            </>
          )}
        </>
      )}

      {done && (
        <>
          <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: C.accentDim, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={score === l.quiz.length ? 'ribbon' : 'school'} size={34} color={C.accent} />
            </View>
            <Txt size={24} bold>You scored {score} of {l.quiz.length}</Txt>
            <Txt size={15} color={C.muted} center>{score === l.quiz.length ? 'Full marks. This lesson is passed.' : 'Get every question right to pass the lesson. You can try as many times as you like.'}</Txt>
          </Card>
          {score < l.quiz.length && <Btn title="Try again" onPress={again} />}
          <Btn title="Back to lessons" kind={score < l.quiz.length ? 'ghost' : 'primary'} onPress={() => router.back()} />
        </>
      )}
    </Page>
  );
}
