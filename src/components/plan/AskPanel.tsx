import { useState, type SubmitEvent } from 'react';
import { localAnswer, planFacts } from '../../engine/facts';
import { modelLabel } from '../../lib/api';
import { useAi } from '../../lib/useAi';
import { AnswerSchema } from '../../schemas/api';
import { useActivePlan } from '../../state/PlanContext';
import { Working } from '../common';

interface Turn {
  role: 'user' | 'assistant';
  text: string;
  source?: string;
}

/** How much of the conversation is sent with each question (matches the API's limits). */
const HISTORY_TURNS = 6;
const HISTORY_TEXT_LENGTH = 600;

const SUGGESTIONS = [
  'Kitna kharcha bacha hai?',
  'What should we book first?',
  'How do I politely negotiate with the caterer?',
];

/** Ask anything about the plan. Gemini answers from the plan's facts; the built-in planner answers if AI is down. */
export function AskPanel() {
  const { plan, schedule } = useActivePlan();
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const ask = useAi('/api/ask', AnswerSchema);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const facts = planFacts(plan, schedule);
    const history = turns
      .slice(-HISTORY_TURNS)
      .map(({ role, text: said }) => ({ role, text: said.slice(0, HISTORY_TEXT_LENGTH) }));
    setTurns((current) => [...current, { role: 'user', text: trimmed }]);
    setQuestion('');
    const result = await ask.run({ question: trimmed, facts, history });
    if (!result.ok && result.code === 'CANCELLED') return;
    const reply: Turn = result.ok
      ? {
          role: 'assistant',
          text: result.data.answer,
          source: `Answered by ${modelLabel(result.model)}`,
        }
      : {
          role: 'assistant',
          text: localAnswer(trimmed, facts),
          source: 'Built-in planner (AI unavailable)',
        };
    setTurns((current) => [...current, reply]);
  }

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    void send(question);
  }

  return (
    <section className="card ask" aria-labelledby="ask-title">
      <h2 id="ask-title">Ask about your plan</h2>
      <p className="hint">English, Hindi or Hinglish. Answers use only your plan&apos;s numbers.</p>
      <ol className="chat" aria-live="polite">
        {turns.map((turn, index) => (
          <li key={index} className={`turn turn-${turn.role}`}>
            <span className="sr-only">{turn.role === 'user' ? 'You asked:' : 'Tayyari:'}</span>
            <p>{turn.text}</p>
            {turn.source ? <p className="source-note">{turn.source}</p> : null}
          </li>
        ))}
      </ol>
      {ask.loading ? <Working label="Thinking about your plan…" /> : null}
      <div className="examples" role="group" aria-label="Suggested questions">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            className="chip"
            onClick={() => void send(suggestion)}
          >
            {suggestion}
          </button>
        ))}
      </div>
      <form className="ask-form" onSubmit={submit}>
        <label htmlFor="ask-input" className="sr-only">
          Your question
        </label>
        <input
          id="ask-input"
          maxLength={400}
          placeholder="e.g. Are we over budget?"
          value={question}
          onChange={(event) => {
            setQuestion(event.target.value);
          }}
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!question.trim() || ask.loading}
        >
          Ask
        </button>
      </form>
    </section>
  );
}
