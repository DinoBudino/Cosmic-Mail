import { DISCOVERY_QUESTIONS } from '../../data/personalization'
import { useOnboardingStore } from '../../store/onboardingStore'

/**
 * PIP asks the question in his bubble (see Cabin). The answers live on
 * a holographic tablet floating in the cabin, and the tablet only
 * appears once PIP has finished asking. Each option is just the action
 * the explorer would take. Selecting one confirms it and moves on.
 */
export function DiscoveryQuestions() {
  const questionIndex = useOnboardingStore((state) => state.questionIndex)
  const dialogueIndex = useOnboardingStore((state) => state.dialogueIndex)
  const answerQuestion = useOnboardingStore((state) => state.answerQuestion)
  const goBack = useOnboardingStore((state) => state.goBack)

  const question = DISCOVERY_QUESTIONS[questionIndex]
  if (!question) return null

  // PIP has two lines per question (lead-in + question); the tablet
  // appears once he reaches the question line.
  const ready = dialogueIndex >= 1

  return (
    <section className="quest" aria-labelledby="question-title">
      <button type="button" className="identity__back" onClick={goBack}>
        ← Back
      </button>

      <h1 id="question-title" className="sr-only">
        {question.question}
      </h1>

      <div className={`tablet${ready ? ' is-ready' : ''}`} aria-hidden={!ready}>
        <div className="tablet__header">
          <span>Routine check</span>
          <span
            className="quest__progress"
            role="img"
            aria-label={`Question ${questionIndex + 1} of ${DISCOVERY_QUESTIONS.length}`}
          >
            {DISCOVERY_QUESTIONS.map((entry, index) => (
              <span
                key={entry.id}
                className={
                  index < questionIndex
                    ? 'onboarding__progress-dot is-done'
                    : index === questionIndex
                      ? 'onboarding__progress-dot is-current'
                      : 'onboarding__progress-dot'
                }
              />
            ))}
          </span>
        </div>

        <div className="choice-list" role="group" aria-label="Answer choices">
          {question.choices.map((choice) => (
            <button
              key={choice.id}
              type="button"
              className="choice-option"
              disabled={!ready}
              onClick={() => answerQuestion(choice.trait)}
            >
              <span className="choice-option__title">{choice.title}</span>
              <span className="choice-option__hint">{choice.hint}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
