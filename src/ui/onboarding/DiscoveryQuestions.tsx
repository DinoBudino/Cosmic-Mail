import { useEffect, useRef, useState } from 'react'
import { DISCOVERY_QUESTIONS } from '../../data/personalization'
import { useGameStore } from '../../store/gameStore'
import { useOnboardingStore } from '../../store/onboardingStore'
import { ROUTINE_LABELS } from './routineDioramaTexture'

/**
 * The Routine Check, presented as an interactive holographic ritual:
 * PIP asks in his bubble (Cabin) while the matching diorama plays
 * inside the Cosmic Memory Window. Answers live in a compact game
 * selector under the window — focusing an option only lights the
 * matching diorama element; confirming records the vote once and
 * the diorama exits before the next question.
 */
export function DiscoveryQuestions() {
  const questionIndex = useOnboardingStore((state) => state.questionIndex)
  const dialogueIndex = useOnboardingStore((state) => state.dialogueIndex)
  const answerQuestion = useOnboardingStore((state) => state.answerQuestion)
  const goBack = useOnboardingStore((state) => state.goBack)
  const reducedMotion = useGameStore((state) => state.reducedMotion)

  const [focusedOptionId, setFocusedOptionId] = useState<string | null>(null)
  const [confirmedOptionId, setConfirmedOptionId] = useState<string | null>(null)
  const confirmTimerRef = useRef<number | null>(null)

  const question = DISCOVERY_QUESTIONS[questionIndex]
  const setRoutineFocus = useOnboardingStore((state) => state.setRoutineFocus)

  // Reset the visual state for each new question (stable ids, never
  // the voice/dialogue state owned by Cabin + the store). Adjusting
  // state during render is the React-endorsed pattern for resets
  // derived from props/state, so no effect is needed.
  const [seenQuestionIndex, setSeenQuestionIndex] = useState(questionIndex)
  if (seenQuestionIndex !== questionIndex) {
    setSeenQuestionIndex(questionIndex)
    setFocusedOptionId(null)
    setConfirmedOptionId(null)
    setRoutineFocus(null)
  }

  useEffect(
    () => () => {
      if (confirmTimerRef.current !== null) window.clearTimeout(confirmTimerRef.current)
      setRoutineFocus(null)
    },
    [setRoutineFocus],
  )

  if (!question) return null

  // PIP has two lines per question (lead-in + question), except Q1
  // which goes straight to the question; the selector appears once
  // he reaches the question line.
  const ready = dialogueIndex >= (questionIndex === 0 ? 0 : 1)
  const focusedChoice =
    question.choices.find((choice) => choice.id === (confirmedOptionId ?? focusedOptionId)) ?? null

  const focusOption = (choiceId: string | null) => {
    setFocusedOptionId(choiceId)
    setRoutineFocus(choiceId)
  }

  const confirm = (choiceId: string, trait: (typeof question.choices)[number]['trait']) => {
    if (!ready || confirmedOptionId) return
    setConfirmedOptionId(choiceId)
    setRoutineFocus(choiceId)
    const delay = reducedMotion ? 0 : 520
    confirmTimerRef.current = window.setTimeout(() => {
      answerQuestion(trait)
    }, delay)
  }

  return (
    <section className="quest routine" aria-labelledby="question-title">
      <button type="button" className="identity__back" onClick={goBack}>
        ← Back
      </button>

      <h1 id="question-title" className="sr-only">
        {question.question}
      </h1>

      {/* The diorama itself is projected in 3D inside the Cosmic
          Memory Window (see MenuScene), so PIP passes in front of it
          and the circular window clips it. Screen readers get the
          scene described here instead. */}
      <p className="sr-only">{ROUTINE_LABELS[question.id]}</p>

      <div className={`routine__selector${ready ? ' is-ready' : ''}`} aria-hidden={!ready}>
        {/* One compact holographic console: header, choices and the
            contextual description live inside the same glass panel,
            so nothing floats loose over the console plating. */}
        <div className="routine__panel">
          <span className="routine__corner routine__corner--tl" aria-hidden="true" />
          <span className="routine__corner routine__corner--tr" aria-hidden="true" />
          <span className="routine__corner routine__corner--bl" aria-hidden="true" />
          <span className="routine__corner routine__corner--br" aria-hidden="true" />

          <div className="routine__header">
            <span>{question.section}</span>
            <span aria-label={`Question ${questionIndex + 1} of ${DISCOVERY_QUESTIONS.length}`}>
              {String(questionIndex + 1).padStart(2, '0')} / {String(DISCOVERY_QUESTIONS.length).padStart(2, '0')}
            </span>
          </div>

          <div className="routine__choices" role="group" aria-label="Answer choices">
            {question.choices.map((choice, index) => {
              const isFocused = (confirmedOptionId ?? focusedOptionId) === choice.id
              const isConfirmed = confirmedOptionId === choice.id
              return (
                <button
                  key={choice.id}
                  type="button"
                  className={`routine__choice${isFocused ? ' is-focused' : ''}${isConfirmed ? ' is-confirmed' : ''}`}
                  disabled={!ready || Boolean(confirmedOptionId)}
                  onMouseEnter={() => focusOption(choice.id)}
                  onFocus={() => focusOption(choice.id)}
                  onClick={() => confirm(choice.id, choice.trait)}
                >
                  <span className="routine__choice-index" aria-hidden="true">
                    {index + 1}
                  </span>
                  <span className="routine__choice-title">{choice.title}</span>
                  {isConfirmed && (
                    <span className="routine__choice-check" aria-hidden="true">
                      ✓
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Fixed-height description zone inside the panel: the
              text never shifts the layout and never sits on the
              console logo. */}
          <p className="routine__hint" aria-live="polite">
            {focusedChoice ? focusedChoice.hint : 'Hover or focus an option to peek at the scene…'}
          </p>
          <p className="routine__controls">Enter or click to confirm · ← Back to revisit</p>
        </div>
      </div>
    </section>
  )
}
