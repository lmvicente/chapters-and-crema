import Lab from '@/components/Lab';
import { PARTS, QUESTIONS } from '@/lib/questions';

export default function Page() {
  return <Lab parts={PARTS} questions={QUESTIONS} />;
}
