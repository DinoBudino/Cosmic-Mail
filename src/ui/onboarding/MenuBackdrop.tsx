const STARS = [
  { x: '8%', y: '14%', size: '3px' },
  { x: '18%', y: '32%', size: '2px' },
  { x: '27%', y: '10%', size: '2px' },
  { x: '36%', y: '22%', size: '3px' },
  { x: '44%', y: '8%', size: '2px' },
  { x: '52%', y: '28%', size: '3px' },
  { x: '61%', y: '12%', size: '2px' },
  { x: '69%', y: '34%', size: '3px' },
  { x: '82%', y: '20%', size: '2px' },
  { x: '90%', y: '44%', size: '3px' },
  { x: '14%', y: '58%', size: '2px' },
  { x: '24%', y: '72%', size: '3px' },
  { x: '38%', y: '64%', size: '2px' },
  { x: '48%', y: '80%', size: '2px' },
  { x: '58%', y: '58%', size: '3px' },
  { x: '66%', y: '74%', size: '2px' },
  { x: '76%', y: '62%', size: '2px' },
  { x: '86%', y: '78%', size: '3px' },
  { x: '5%', y: '84%', size: '2px' },
  { x: '95%', y: '66%', size: '2px' },
] as const

/** Pure-CSS space backdrop: stars, a distant planet and a small moon. */
export function MenuBackdrop() {
  return (
    <div className="onboarding__backdrop" aria-hidden="true">
      {STARS.map((star, index) => (
        <span
          key={index}
          className="onboarding__star"
          style={{ '--x': star.x, '--y': star.y, '--size': star.size } as React.CSSProperties}
        />
      ))}
      <span className="onboarding__planet" />
      <span className="onboarding__moon" />
    </div>
  )
}
