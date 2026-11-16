import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { clockText } from './tabletClock'
import { getAlbumPhotos, unlockedPhotoCount } from '../../data/albumPhotos'
import { getFieldNotesView } from '../../data/fieldNotes'
import { getMission, type MissionId } from '../../data/missions'
import { getPassportView, type PassportStory } from '../../data/passport'
import type { JourneySave } from '../../store/journeySchema'
import { emitAudio } from '../../game/audio/audioEvents'
import { onPipVoiceEnded, speakPip, stopPipVoice } from '../../game/pipVoice'
import type { AlbumGuideTarget } from '../../data/albumGuide'
import { useNarrativeStore } from '../../store/narrativeStore'
import { useAlbumGuide } from '../useAlbumGuide'
import { watchStory } from '../sendFilm'
import { useGameStore } from '../../store/gameStore'
import { useJourneyStore } from '../../store/journeyStore'
import { useOnboardingStore, type AlbumTab } from '../../store/onboardingStore'
import { hubElementEnabled, useHubFocus } from '../../store/hubFocus'
import { areAllMissionsComplete } from '../../store/journeyLogic'
import { keepsakeDataFor } from '../keepsakeData'
import { downloadKeepsake } from '../keepsakes'
import { useAlbumPipSlot } from './albumPipSlot'
import './album.css'

const ALBUM_TABS: readonly { id: AlbumTab; label: string; icon: IconName }[] = [
  { id: 'missions', label: 'Explorers', icon: 'rover' },
  { id: 'discoveries', label: 'Discoveries', icon: 'search' },
  { id: 'stamps', label: 'Stamps', icon: 'stamp' },
]

type PlanetFilter = 'all' | 'mars' | 'moon'
type LabId = MissionId | 'notes'

const PIP_PORTRAIT = 'album/pip.webp'

/**
 * The Cosmic Album: a rugged tablet the carrier keeps in the cabin and
 * on Mars (store and save keys keep the historical "passport" names). It
 * is a read-only projection of JourneySave:
 * - Explorers: progress, a stamp-edged card per explorer and its rewards.
 * - Discoveries: the photo lab (stills from each story video) and the
 *   Mars field notes.
 * - Stamps: the stamp collection, one per explorer whose story reaches
 *   Earth.
 * Names stay hidden until the explorer is found, and a legacy B seal is
 * never shown as a delivery.
 */
export function Passport({
  saveOverride,
  onClose,
}: {
  /** Testing/embedding hook; production always reads the journey store. */
  saveOverride?: JourneySave | null
  /** Shows the close button of the tablet. */
  onClose?: () => void
}) {
  const storedSave = useJourneyStore((state) => state.save)
  const save = saveOverride !== undefined ? saveOverride : storedSave
  const prepareSmartLetter = useJourneyStore((state) => state.prepareSmartLetter)
  const openArchive = useGameStore((state) => state.openArchive)
  const archiveOpen = useGameStore((state) => state.archiveView !== 'none')
  const voiceEnabled = useGameStore((state) => state.voiceEnabled)
  const tab = useOnboardingStore((state) => state.albumTab)
  const setTab = useOnboardingStore((state) => state.setAlbumTab)
  const setSlot = useAlbumPipSlot((state) => state.setSlot)
  const focus = useHubFocus()
  const [message, setMessage] = useState<string | null>(null)
  const [planet, setPlanet] = useState<PlanetFilter>('all')
  const [rewardsFor, setRewardsFor] = useState<MissionId | null>(null)
  const [labPick, setLabPick] = useState<LabId | null>(null)
  // PIP guiding a just-completed explorer (opened by the game, not the HUD).
  const [introDone, setIntroDone] = useState(false)
  const guide = useAlbumGuide(introDone)
  const guideStep = guide.step
  const guideLocked = guideStep?.locked ?? false
  const screenRef = useRef<HTMLDivElement>(null)

  // Opened for an explorer: show its card on the Explorers page.
  useEffect(() => {
    if (!guide.focusId) return
    setTab('missions')
    setPlanet('all')
    setRewardsFor(null)
    const frame = window.requestAnimationFrame(() => {
      screenRef.current
        ?.querySelector(`[data-mission="${guide.focusId}"]`)
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [guide.focusId, setTab])

  // PIP says each step once; never over the story video on top.
  const guideId = guideStep?.id ?? null
  const guideText = guideStep?.text ?? null
  useEffect(() => {
    if (!guideId || !guideText || archiveOpen) return
    useNarrativeStore.getState().markSpoken(guideId)
    speakPip(guideText, voiceEnabled, 'excited')
    return () => stopPipVoice()
  }, [guideId, guideText, archiveOpen, voiceEnabled])

  // The first-time intro hands over to the first action when PIP is done.
  const onIntro = guideStep?.target === 'card'
  useEffect(() => {
    if (!onIntro || archiveOpen) return
    const finish = () => setIntroDone(true)
    const off = onPipVoiceEnded(finish)
    const fallback = window.setTimeout(finish, voiceEnabled ? 9000 : 4500)
    return () => {
      off()
      window.clearTimeout(fallback)
    }
  }, [onIntro, archiveOpen, voiceEnabled])

  if (!save) return null

  const view = getPassportView(save)
  // Every story delivered: the carrier is a Master Carrier and the
  // finale's keepsakes stay downloadable from the album.
  const master = areAllMissionsComplete(save)
  const tourClass = (target: string) =>
    focus.tourActive && focus.target === target ? ' is-tour-target' : ''
  // While PIP's tour explains the album, his own bubble sits in the PIP
  // corner (moved there by the cabin), so the greeting steps aside.
  const pipGuiding = focus.step?.place === 'album'
  const found = view.stories.filter((story) => story.machineName).length
  const stamped = view.stories.filter((story) => story.stampEarned).length
  const overall = Math.round(
    view.stories.reduce((sum, story) => sum + story.percent, 0) /
      Math.max(1, view.stories.length),
  )
  const firstOpen =
    view.stories.find((story) => story.machineName) ??
    view.stories.find((story) => story.destination.available)
  const labId: LabId = labPick ?? firstOpen?.missionId ?? 'notes'

  const goTab = (next: AlbumTab) => {
    emitAudio('uiHover', { dedupeKey: 'album-tab', dedupeMs: 120 })
    setRewardsFor(null)
    setTab(next)
  }

  const handlePrepare = (missionId: MissionId) => {
    const result = prepareSmartLetter(missionId)
    const ok = result?.status === 'created' || result?.status === 'already-created'
    emitAudio(ok ? 'smartLetterPrepared' : 'archiveQueryFailed')
    setMessage(
      ok ? null : 'The memory must be recovered before the smart letter can be prepared.',
    )
  }

  const greeting =
    tab === 'discoveries'
      ? 'Welcome to the photo lab! Look at the pictures and facts we recover from each explorer.'
      : tab === 'stamps'
        ? 'Every story we send home to Earth earns a stamp. Can you fill the whole page?'
        : `Hi, ${view.carrierName}! This is your Cosmic Album. Here you can see your progress and your rewards.`

  return (
    <div className="ctab" role="dialog" aria-label="Cosmic Album" data-guided={guideStep ? 'true' : undefined}>
      <div className="ctab__bezel">
        <TabletShell />
        <div
          ref={screenRef}
          className="ctab__screen"
          onPointerDown={(event) => {
            if (!(event.target as HTMLElement).closest?.('.xcard__rewards')) {
              setRewardsFor(null)
            }
          }}
        >
          <header className="ctab__top">
            <p className="ctab__brand">
              <span className="ctab__brand-planet" aria-hidden="true" />
              <span className="ctab__brand-text">
                Cosmic
                <b>Mail</b>
              </span>
            </p>
            <h2 className="ctab__title">
              <span aria-hidden="true">✦</span> Cosmic Album <span aria-hidden="true">✦</span>
            </h2>
            <div className="ctab__tabs" role="tablist" aria-label="Album sections">
              {ALBUM_TABS.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  role="tab"
                  id={`album-tab-${entry.id}`}
                  aria-selected={tab === entry.id}
                  aria-controls="album-panel"
                  className={`ctab__tab${tab === entry.id ? ' is-active' : ''}${tourClass(
                    `tab-${entry.id}`,
                  )}`}
                  disabled={guideLocked || !hubElementEnabled(focus, `tab-${entry.id}`)}
                  onClick={() => goTab(entry.id)}
                >
                  <Icon name={entry.icon} />
                  {entry.label}
                </button>
              ))}
            </div>
            {onClose && (
              <button
                type="button"
                className={`ctab__close${tourClass('album-close')}${
                  guideStep?.target === 'close' ? ' is-tour-target is-guide-target' : ''
                }`}
                aria-label="Close album"
                disabled={guideLocked || !hubElementEnabled(focus, 'album-close')}
                onClick={onClose}
              >
                <Icon name="close" />
              </button>
            )}
          </header>

          {/* Phones stack PIP's corner above the cards, out of sight while
              the child looks at the explorer: his guide line stays here. */}
          {guideStep && (
            <p key={guideStep.id} className="ctab__guide-strip" role="status">
              <img className="ctab__guide-strip-img" src={PIP_PORTRAIT} alt="" />
              <span>{guideStep.text}</span>
            </p>
          )}
          <div className={`ctab__body ctab__body--${tab}`}>
            <aside className="ctab__side">
              <div className={`ctab__pip${pipGuiding ? ' is-guiding' : ''}`}>
                <img className="ctab__pip-img" src={PIP_PORTRAIT} alt="" />
                {!pipGuiding && (
                  <p
                    key={guideStep?.id ?? 'greeting'}
                    className={`ctab__speech${guideStep ? ' is-guide' : ''}`}
                    role={guideStep ? 'status' : undefined}
                  >
                    <span className="ctab__speech-spark" aria-hidden="true">
                      ✦
                    </span>
                    {guideStep?.text ?? greeting}
                  </p>
                )}
                <div ref={setSlot} className="ctab__pip-slot" />
              </div>

              {tab === 'discoveries' ? (
                <SidePanel icon="search" title="Select an explorer" scroll>
                  <div className="lab-pick">
                    {view.stories.map((story) => {
                      const photo = getAlbumPhotos(story.missionId)[0]
                      return (
                        <button
                          key={story.missionId}
                          type="button"
                          className={`lab-pick__tile${labId === story.missionId ? ' is-active' : ''}${
                            story.machineName ? '' : ' is-locked'
                          }`}
                          aria-pressed={labId === story.missionId}
                          onClick={() => setLabPick(story.missionId)}
                        >
                          <span className="lab-pick__img">
                            {story.machineName && photo ? (
                              <img src={photo.src} alt="" loading="lazy" />
                            ) : (
                              <Icon name="lock" />
                            )}
                          </span>
                          <span className="lab-pick__name">
                            {story.machineName ?? 'Unknown'}
                          </span>
                        </button>
                      )
                    })}
                    <button
                      type="button"
                      className={`lab-pick__tile lab-pick__tile--notes${
                        labId === 'notes' ? ' is-active' : ''
                      }`}
                      aria-pressed={labId === 'notes'}
                      onClick={() => setLabPick('notes')}
                    >
                      <span className="lab-pick__img">
                        <Icon name="pin" />
                      </span>
                      <span className="lab-pick__name">Mars notes</span>
                    </button>
                  </div>
                </SidePanel>
              ) : (
                <>
                  <SidePanel icon="chart" title={tab === 'stamps' ? 'My collection' : 'Exploration progress'}>
                    {tab === 'stamps' ? (
                      <Meter
                        icon="stamp"
                        label="Stamps collected"
                        value={
                          <>
                            {stamped} <small>of</small> {view.totalStories}
                          </>
                        }
                        percent={(stamped / Math.max(1, view.totalStories)) * 100}
                        tone="orange"
                      />
                    ) : (
                      <Meter
                        icon="rover"
                        label="Explorers found"
                        value={
                          <>
                            {found} <small>of</small> {view.totalStories}
                          </>
                        }
                        percent={(found / Math.max(1, view.totalStories)) * 100}
                        tone="orange"
                      />
                    )}
                    <Meter
                      icon="dish"
                      label="Stories sent to Earth"
                      value={`${overall}%`}
                      percent={overall}
                      tone="blue"
                    />
                  </SidePanel>
                  {tab === 'missions' && (
                    <SidePanel icon="rocket" title="Explore by planet">
                      <div className="ctab__planets">
                        {(
                          [
                            ['mars', 'Mars'],
                            ['moon', 'Moon'],
                          ] as const
                        ).map(([id, label]) => (
                          <button
                            key={id}
                            type="button"
                            className={`ctab__planet ctab__planet--${id}`}
                            aria-pressed={planet === id}
                            onClick={() => setPlanet(planet === id ? 'all' : id)}
                          >
                            <span className="ctab__orb" aria-hidden="true" />
                            {label}
                          </button>
                        ))}
                      </div>
                    </SidePanel>
                  )}
                  {master && tab === 'stamps' && (
                    <SidePanel icon="stamp" title="My keepsakes">
                      <div className="ctab__keepsakes">
                        <button
                          type="button"
                          className="ctab__keepsake"
                          aria-label="Download my certificate"
                          onClick={() => {
                            emitAudio('uiConfirm')
                            void downloadKeepsake('certificate', keepsakeDataFor(save))
                          }}
                        >
                          Certificate
                        </button>
                        <button
                          type="button"
                          className="ctab__keepsake"
                          aria-label="Download PIP's postcard"
                          onClick={() => {
                            emitAudio('uiConfirm')
                            void downloadKeepsake('postcard', keepsakeDataFor(save))
                          }}
                        >
                          Postcard
                        </button>
                      </div>
                    </SidePanel>
                  )}
                  <div className={`ctab__carrier${master ? ' is-master' : ''}${tourClass('album-id')}`}>
                    <span className="ctab__wing ctab__wing--l" aria-hidden="true" />
                    <span className="ctab__wing ctab__wing--r" aria-hidden="true" />
                    <span className="ctab__carrier-face" aria-hidden="true">
                      <Icon name="astronaut" />
                    </span>
                    <span className="ctab__carrier-text">
                      <b>{master ? 'Master Carrier' : 'Cosmic Carrier'}</b>
                      <span>
                        {view.carrierName} · ID {view.carrierId}
                      </span>
                    </span>
                  </div>
                </>
              )}
            </aside>

            <section
              id="album-panel"
              role="tabpanel"
              aria-labelledby={`album-tab-${tab}`}
              className="ctab__main"
            >
              {tab === 'missions' && (
                <div className="xgrid">
                  {view.stories
                    .filter((story) => planet === 'all' || story.destination.id === planet)
                    .map((story) => (
                      <ExplorerCard
                        key={story.missionId}
                        story={story}
                        rewardsOpen={rewardsFor === story.missionId}
                        onRewards={() =>
                          setRewardsFor(rewardsFor === story.missionId ? null : story.missionId)
                        }
                        guideTarget={
                          story.missionId === guide.focusId ? (guideStep?.target ?? null) : null
                        }
                        focused={story.missionId === guide.focusId}
                        onPrepare={() => {
                          setIntroDone(true)
                          handlePrepare(story.missionId)
                        }}
                        onDeliver={() => {
                          setRewardsFor(null)
                          watchStory(story.missionId)
                        }}
                        onWatch={() => {
                          setRewardsFor(null)
                          openArchive('reconstruction', story.missionId)
                        }}
                        onLetter={() => {
                          setRewardsFor(null)
                          openArchive('smart-letter', story.missionId)
                        }}
                        onPhotos={() => {
                          setLabPick(story.missionId)
                          goTab('discoveries')
                        }}
                        onStamp={() => goTab('stamps')}
                      />
                    ))}
                </div>
              )}

              {tab === 'discoveries' &&
                (labId === 'notes' ? (
                  <FieldNotes save={save} />
                ) : (
                  <PhotoLab
                    key={labId}
                    story={view.stories.find((story) => story.missionId === labId) ?? null}
                  />
                ))}

              {tab === 'stamps' && <StampPage stories={view.stories} />}

              {message && (
                <p className="ctab__message" role="status">
                  {message}
                </p>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Rugged frame parts: bumpers, grilles, camera bar, clock and plate. */
function TabletShell() {
  return (
    <>
      <span className="ctab__bump ctab__bump--tl" aria-hidden="true" />
      <span className="ctab__bump ctab__bump--tr" aria-hidden="true" />
      <span className="ctab__bump ctab__bump--bl" aria-hidden="true" />
      <span className="ctab__bump ctab__bump--br" aria-hidden="true" />
      <span className="ctab__guard ctab__guard--l" aria-hidden="true" />
      <span className="ctab__guard ctab__guard--r" aria-hidden="true" />
      <span className="ctab__grill ctab__grill--l" aria-hidden="true" />
      <span className="ctab__grill ctab__grill--r" aria-hidden="true" />
      <span className="ctab__screw ctab__screw--l" aria-hidden="true" />
      <span className="ctab__screw ctab__screw--r" aria-hidden="true" />
      <span className="ctab__cam" aria-hidden="true">
        <i />
      </span>
      <TabletClock />
      <span className="ctab__plate" aria-hidden="true">
        Cosmic Mail
      </span>
    </>
  )
}

function TabletClock() {
  const [time, setTime] = useState(() => clockText())
  useEffect(() => {
    // Tick right when the minute changes, then every minute.
    let interval = 0
    const tick = () => setTime(clockText())
    const wait = 60000 - (Date.now() % 60000) + 50
    const first = window.setTimeout(() => {
      tick()
      interval = window.setInterval(tick, 60000)
    }, wait)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(interval)
    }
  }, [])
  return (
    <span className="ctab__clock" aria-hidden="true">
      {time}
    </span>
  )
}

function SidePanel({
  icon,
  title,
  scroll = false,
  children,
}: {
  icon: IconName
  title: string
  /** Fill the side column's free height and scroll the content inside. */
  scroll?: boolean
  children: ReactNode
}) {
  return (
    <section className={`ctab__card${scroll ? ' ctab__card--scroll' : ''}`}>
      <h3 className="ctab__bar">
        <Icon name={icon} />
        {title}
      </h3>
      {scroll ? (
        <ScrollBody>{children}</ScrollBody>
      ) : (
        <div className="ctab__card-body">{children}</div>
      )}
    </section>
  )
}

/**
 * A card body that scrolls on its own, with a soft fade and a bouncing
 * arrow at the bottom while more tiles wait below, so children notice
 * there is more to see (a thin scrollbar alone is easy to miss).
 */
function ScrollBody({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [more, setMore] = useState(false)
  const measure = useCallback(() => {
    const node = ref.current
    if (!node) return
    setMore(node.scrollTop + node.clientHeight < node.scrollHeight - 4)
  }, [])
  useEffect(() => {
    const node = ref.current
    if (!node) return
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    for (const child of Array.from(node.children)) observer.observe(child)
    return () => observer.disconnect()
  }, [measure])
  return (
    <div className="ctab__scroll" data-more={more}>
      <div ref={ref} className="ctab__card-body ctab__scroll-body" onScroll={measure}>
        {children}
      </div>
      {more && (
        <button
          type="button"
          className="ctab__more"
          aria-label="Show more explorers"
          onClick={() => ref.current?.scrollBy({ top: ref.current.clientHeight * 0.7, behavior: 'smooth' })}
        >
          <span aria-hidden="true">▾</span>
        </button>
      )}
    </div>
  )
}

/** What the child does next, in one short line. */
function statusLine(story: PassportStory): string {
  if (!story.destination.available) return 'This trip is coming soon.'
  switch (story.status) {
    case 'unknown':
      return 'No signal identified yet. Follow the navigation screen.'
    case 'discovered':
      return 'Explorer identified. Scan its parts.'
    case 'investigating':
    case 'ready_for_full_scan':
      return `Fragments recognized ${story.scanned}/${story.total}.`
    case 'memory_recovered':
      return 'Memory recovered. Seal the letter!'
    case 'smart_letter_ready':
      return 'Letter sealed. Watch its story and send it home.'
    default:
      return 'Delivered to Earth.'
  }
}

function ExplorerCard({
  story,
  guideTarget,
  focused,
  rewardsOpen,
  onRewards,
  onPrepare,
  onDeliver,
  onWatch,
  onLetter,
  onPhotos,
  onStamp,
}: {
  story: PassportStory
  /** What PIP points at on this card while he guides it. */
  guideTarget: AlbumGuideTarget | null
  /** The explorer the album was opened for. */
  focused: boolean
  rewardsOpen: boolean
  onRewards: () => void
  onPrepare: () => void
  onDeliver: () => void
  onWatch: () => void
  onLetter: () => void
  onPhotos: () => void
  onStamp: () => void
}) {
  const known = story.machineName !== null
  const photo = getAlbumPhotos(story.missionId)[0]
  const done = story.percent === 100
  return (
    <article
      className={`xcard${known ? '' : ' is-locked'}${done ? ' is-done' : ''}${
        rewardsOpen ? ' is-open' : ''
      }${focused ? ' is-focus' : ''}`}
      data-mission={story.missionId}
      aria-label={`${story.machineName ?? 'Explorer not yet identified'} · ${story.destination.name}`}
    >
      <div className="xcard__in">
        <header className="xcard__head">
          <h3>{story.machineName ?? 'Unknown explorer'}</h3>
          <PlanetChip story={story} />
        </header>

        <div className="xcard__img">
          {photo && <img src={photo.src} alt="" loading="lazy" />}
          {!known && (
            <span className="xcard__lock">
              <Icon name="lock" />
              {story.destination.available ? '???' : 'Coming soon'}
            </span>
          )}
        </div>

        <div
          className="xcard__bar"
          role="progressbar"
          aria-label="Story progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={story.percent}
        >
          {story.percent > 0 && <span style={{ width: `${story.percent}%` }} />}
          <b>{story.percent}%</b>
        </div>

        <p className="xcard__status">{statusLine(story)}</p>

        <span
          className="xcard__stars"
          aria-label={`${Math.min(story.scanned, story.total)} of ${story.total} parts scanned`}
        >
          {Array.from({ length: story.total }, (_, index) => (
            <Icon key={index} name={index < story.scanned ? 'star' : 'star-empty'} />
          ))}
        </span>

        {story.legacySealAt != null && !story.stampEarned && (
          <p className="xcard__legacy">
            Legacy seal found in an older save. It is kept as history, but it is not a
            delivery to Earth.
          </p>
        )}

        <div className="xcard__actions">
          {story.status === 'memory_recovered' ? (
            <button
              type="button"
              className={`xcard__btn xcard__btn--action${guideTarget === 'seal' ? ' is-tour-target is-guide-target' : ''}`}
              onClick={onPrepare}
            >
              <span aria-hidden="true">✉</span> Seal the letter
            </button>
          ) : story.canTransmit ? (
            <button
              type="button"
              className={`xcard__btn xcard__btn--action${guideTarget === 'story' ? ' is-tour-target is-guide-target' : ''}`}
              onClick={onDeliver}
            >
              <span aria-hidden="true">▶</span> Watch its story
            </button>
          ) : (
            <div className="xcard__rewards">
              <button
                type="button"
                className="xcard__btn"
                aria-expanded={rewardsOpen}
                disabled={!known}
                onClick={onRewards}
              >
                See rewards
              </button>
              {rewardsOpen && (
                <div className="xcard__pop" role="menu" aria-label="Rewards">
                  <PopItem art="clapper" disabled={!story.reconstructionAvailable} onClick={onWatch}>
                    Watch story
                  </PopItem>
                  <PopItem art="lens" onClick={onPhotos}>
                    Discoveries
                  </PopItem>
                  <PopItem art="stamp" disabled={!story.stampEarned} onClick={onStamp}>
                    Stamp
                  </PopItem>
                  {story.hasSmartLetter && (
                    <PopItem art="letter" onClick={onLetter}>
                      Letter
                    </PopItem>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

function PlanetChip({ story }: { story: PassportStory }) {
  return (
    <span className={`xcard__chip xcard__chip--${story.destination.id}`}>
      <span className="ctab__orb" aria-hidden="true" />
      {story.destination.name}
    </span>
  )
}

function PopItem({
  art,
  disabled = false,
  onClick,
  children,
}: {
  art: ArtName
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className="xcard__pop-item"
      disabled={disabled}
      onClick={onClick}
    >
      <span className="xcard__pop-art">
        <Art name={art} />
        {disabled && (
          <span className="xcard__pop-lock">
            <Icon name="lock" />
          </span>
        )}
      </span>
      <span className="xcard__pop-label">{children}</span>
    </button>
  )
}

/** The stamp page: one big stamp per explorer, cancelled once delivered. */
function StampPage({ stories }: { stories: PassportStory[] }) {
  return (
    <div className="stamps">
      <header className="stamps__head">
        <h3>Stamp collection</h3>
        <p>One stamp for each explorer whose story reaches Earth.</p>
      </header>
      <ul className="stamps__sheet">
        {stories.map((story) => {
          const photo = getAlbumPhotos(story.missionId)[0]
          const mission = getMission(story.missionId)
          return (
            <li
              key={story.missionId}
              className={`stamp stamp--${story.destination.id}${story.stampEarned ? ' is-earned' : ''}`}
            >
              {story.stampEarned ? (
                <div className="stamp__paper">
                  <div className="stamp__face">
                    <p className="stamp__top">
                      <span>Cosmic Mail</span>
                      <span>{story.destination.name}</span>
                    </p>
                    <div className="stamp__img">{photo && <img src={photo.src} alt="" />}</div>
                    <p className="stamp__name">{story.machineName}</p>
                    <p className="stamp__year">{mission.yearLabel}</p>
                  </div>
                  <span className="stamp__postmark" aria-hidden="true">
                    <span>Delivered</span>
                    <b>Earth</b>
                    <span>✦ ✦ ✦</span>
                  </span>
                  <span className="sr-only">{story.stampLabel}: delivered to Earth</span>
                </div>
              ) : (
                <div className="stamp__slot">
                  <span className="stamp__slot-icon">
                    <Icon name={story.machineName ? 'stamp' : 'lock'} />
                  </span>
                  <p className="stamp__name">
                    {story.machineName ?? `${story.destination.name} explorer`}
                  </p>
                  <p className="stamp__hint">
                    {!story.destination.available
                      ? 'Coming soon'
                      : story.machineName
                        ? 'Send its story to Earth'
                        : 'Not yet stamped'}
                  </p>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function PhotoLab({ story }: { story: PassportStory | null }) {
  const [index, setIndex] = useState(0)
  if (!story) return null
  const photos = getAlbumPhotos(story.missionId)
  if (photos.length === 0) return null
  const open = unlockedPhotoCount(photos.length, story)
  const photo = photos[index]
  const unlocked = index < open
  const found = story.machineName !== null
  const mission = getMission(story.missionId)
  const step = (delta: number) =>
    setIndex((current) => (current + delta + photos.length) % photos.length)

  return (
    <div className="lab">
      <section className="lab__viewer ctab__card" aria-labelledby="lab-title">
        <h3 className="ctab__bar">
          <Icon name="camera" />
          Photo lab
        </h3>
        <div className="ctab__card-body">
          <p id="lab-title" className="lab__name">
            {story.machineName ?? 'Unknown explorer'}
            <PlanetChip story={story} />
          </p>
          <div className="lab__frame">
            {unlocked ? (
              <img src={photo.src} alt={photo.title} />
            ) : (
              <span className="lab__hidden">
                <Icon name="lock" />
                {!story.destination.available
                  ? 'This trip is coming soon.'
                  : found
                    ? 'Scan another part to open this photo.'
                    : 'Find this explorer to open its photos.'}
              </span>
            )}
            <button type="button" className="lab__arrow lab__arrow--prev" aria-label="Previous photo" onClick={() => step(-1)}>
              <Icon name="chevron-left" />
            </button>
            <button type="button" className="lab__arrow lab__arrow--next" aria-label="Next photo" onClick={() => step(1)}>
              <Icon name="chevron-right" />
            </button>
          </div>
          <p className="lab__count">
            <b>
              {index + 1} of {photos.length}
            </b>
            <span className="lab__dots" aria-hidden="true">
              {photos.map((entry, at) => (
                <i key={entry.src} className={at === index ? 'is-on' : ''} />
              ))}
            </span>
          </p>
          <div className="lab__thumbs">
            {photos.map((entry, at) => (
              <button
                key={entry.src}
                type="button"
                className={`lab__thumb${at === index ? ' is-active' : ''}${at < open ? '' : ' is-locked'}`}
                aria-label={at < open ? entry.title : 'Locked photo'}
                aria-pressed={at === index}
                onClick={() => setIndex(at)}
              >
                {at < open ? <img src={entry.src} alt="" loading="lazy" /> : <Icon name="lock" />}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="lab__info">
        <SidePanel icon="info" title="About this photo">
          {unlocked ? (
            <>
              <p className="lab__title">{photo.title}</p>
              <p className="lab__text">{photo.description}</p>
              <p className="lab__credit">{photo.credit}</p>
            </>
          ) : (
            <p className="lab__text">
              {found
                ? 'Each part you scan opens one more photo.'
                : 'Find the explorer first. Then each part you scan opens one more photo.'}
            </p>
          )}
        </SidePanel>
        <SidePanel icon="star" title="Key findings">
          <ul className="lab__finds">
            {mission.components.map((component) => {
              const seen = story.scannedIds.includes(component.id) || story.stampEarned
              return (
                <li key={component.id} className={seen ? 'is-seen' : 'is-locked'}>
                  <span className="lab__find-icon">
                    <Icon
                      name={
                        !seen
                          ? 'lock'
                          : component.howItWorks?.verb === 'Touches'
                            ? 'hand'
                            : component.howItWorks?.verb === 'Senses heat'
                              ? 'heat'
                              : 'eye'
                      }
                    />
                  </span>
                  <span>
                    <b>{seen ? component.shortName : 'Part not scanned yet'}</b>
                    {seen && (component.howItWorks?.detail ?? firstSentence(component.historicalRecord))}
                  </span>
                </li>
              )
            })}
          </ul>
        </SidePanel>
      </section>
    </div>
  )
}

function firstSentence(text: string): string {
  const end = text.indexOf('. ')
  return end > 0 ? text.slice(0, end + 1) : text
}

function FieldNotes({ save }: { save: JourneySave }) {
  const fieldNotes = getFieldNotesView(save)
  return (
    <section className="notes ctab__card" aria-labelledby="album-notes-title">
      <h3 id="album-notes-title" className="ctab__bar">
        <Icon name="pin" />
        Mars field notes · {fieldNotes.unlockedCount}/{fieldNotes.totalCount}
      </h3>
      <div className="ctab__card-body">
        <p className="ctab__note">
          Facts from the landscape and the memorials. They are not part of any smart letter.
        </p>
        <ul className="notes__list">
          {fieldNotes.entries.map(({ note, unlocked, detail }) => (
            <li key={note.id} className={`notes__item${unlocked ? ' is-unlocked' : ''}`}>
              <h4>{unlocked ? note.title : 'Not yet observed'}</h4>
              {unlocked ? (
                <>
                  <p>{note.body}</p>
                  <p className="notes__meta">
                    {detail ? `${detail} · ` : ''}
                    {note.sources.map((source, at) => (
                      <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">
                        {source.label}
                        {at < note.sources.length - 1 ? ', ' : ''} ↗
                      </a>
                    ))}
                  </p>
                </>
              ) : (
                <p className="notes__meta">
                  {note.kind === 'memorial'
                    ? 'Visit this Mars memorial to add its note.'
                    : `Scan a feature of this kind with the Cosmic Scanner.${detail ? ` ${detail}.` : ''}`}
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function Meter({
  icon,
  label,
  value,
  percent,
  tone,
}: {
  icon: IconName
  label: string
  value: ReactNode
  percent: number
  tone: 'orange' | 'blue'
}) {
  return (
    <div className={`meter meter--${tone}`}>
      <span className="meter__icon">
        <Icon name={icon} />
      </span>
      <div className="meter__main">
        <p className="meter__row">
          <span>{label}</span>
          <b>{value}</b>
        </p>
        <span className="meter__track" style={{ '--pct': `${Math.round(percent)}%` } as CSSProperties}>
          {percent > 0 && <span />}
        </span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ Icons */

type IconName =
  | 'rover'
  | 'search'
  | 'stamp'
  | 'close'
  | 'lock'
  | 'star'
  | 'star-empty'
  | 'pin'
  | 'chevron-left'
  | 'chevron-right'
  | 'eye'
  | 'hand'
  | 'heat'
  | 'chart'
  | 'rocket'
  | 'dish'
  | 'astronaut'
  | 'camera'
  | 'info'

const ICON_PATHS: Record<IconName, ReactNode> = {
  rover: (
    <>
      <rect x="5" y="9" width="14" height="5" rx="1.5" />
      <path d="M12 9V5m-2 0h4" />
      <circle cx="7" cy="17" r="2" />
      <circle cx="12" cy="17" r="2" />
      <circle cx="17" cy="17" r="2" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="m15 15 5 5" />
    </>
  ),
  stamp: (
    <>
      <path d="M4 4h16v16H4z" strokeDasharray="2 2" />
      <path d="M8 15l3-4 2 2.5 1.5-1.5L17 15Z" />
      <circle cx="9.5" cy="8.5" r="1.3" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  star: <path className="icon-fill" d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z" />,
  'star-empty': <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z" />,
  pin: (
    <>
      <path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11Z" />
      <circle cx="12" cy="10" r="2.2" />
    </>
  ),
  'chevron-left': <path d="m14.5 5-7 7 7 7" />,
  'chevron-right': <path d="m9.5 5 7 7-7 7" />,
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  hand: (
    <>
      <circle cx="12" cy="12" r="6.5" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M9.5 9.5l5 5M14.5 9.5l-5 5" />
    </>
  ),
  heat: (
    <>
      <path d="M12 3c3 3.5 5 6.2 5 9.5a5 5 0 0 1-10 0C7 9.6 9.2 7.5 12 3Z" />
      <path d="M12 12c1.2 1.4 2 2.4 2 3.6a2 2 0 0 1-4 0c0-1.2.8-2.2 2-3.6Z" />
    </>
  ),
  chart: <path className="icon-fill" d="M4 15h3v5H4zM10.5 11h3v9h-3zM17 6h3v14h-3z" />,
  rocket: (
    <>
      <path d="M14 4c3-1 6-1 6-1s0 3-1 6l-6 6-5-5Z" />
      <path d="M8 10 5 10l-2 3 4 1M14 16l0 3-3 2-1-4" />
      <circle cx="15.5" cy="8.5" r="1.4" />
    </>
  ),
  dish: (
    <>
      <path d="M5 8a8 8 0 0 0 11 11Z" />
      <path d="M10.5 13.5 15 9M8 21h7M11 16l-1 5" />
      <path d="M16 4a4 4 0 0 1 4 4M16 1.5a6.5 6.5 0 0 1 6.5 6.5" />
    </>
  ),
  astronaut: (
    <>
      <circle cx="12" cy="9" r="6" />
      <path d="M8.5 9a3.5 2.8 0 0 1 7 0v.6a3.5 2.8 0 0 1-7 0Z" className="icon-fill" />
      <path d="M5.5 21c.5-3.5 3-5.5 6.5-5.5s6 2 6.5 5.5" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8h3l2-2.5h6L17 8h3v11H4Z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5v.5" />
    </>
  ),
}

function Icon({ name }: { name: IconName }) {
  return (
    <svg className={`icon icon--${name}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {ICON_PATHS[name]}
    </svg>
  )
}

type ArtName = 'clapper' | 'lens' | 'stamp' | 'letter'

/** Colourful pictures for the rewards menu. */
function Art({ name }: { name: ArtName }) {
  return (
    <svg className="art" viewBox="0 0 64 48" aria-hidden="true" focusable="false">
      {name === 'clapper' && (
        <>
          <rect x="10" y="18" width="44" height="26" rx="3" fill="#5b3fc4" />
          <path d="M10 10 52 4l2 9-42 6Z" fill="#2b2063" />
          <path d="m16 9 6 9M27 7l6 9M38 6l6 9" stroke="#fff" strokeWidth="3" />
          <path d="M28 24v14l12-7Z" fill="#fff" />
        </>
      )}
      {name === 'lens' && (
        <>
          <circle cx="26" cy="21" r="14" fill="#bfe6ff" stroke="#e8902a" strokeWidth="5" />
          <path d="M20 15a8 8 0 0 1 8-3" stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none" />
          <path d="m36 31 14 13" stroke="#6b3d1a" strokeWidth="7" strokeLinecap="round" />
        </>
      )}
      {name === 'stamp' && (
        <>
          <rect x="8" y="6" width="40" height="34" rx="2" fill="#fff3e2" stroke="#e8902a" strokeWidth="2.5" strokeDasharray="3 2.5" />
          <rect x="13" y="11" width="30" height="24" fill="#ffb27a" />
          <path d="M13 35 24 22l7 8 5-5 7 10Z" fill="#c44a1f" />
          <circle cx="36" cy="17" r="3.5" fill="#fff6c8" />
          <rect x="34" y="30" width="26" height="12" rx="3" fill="#2b2063" transform="rotate(-10 47 36)" />
        </>
      )}
      {name === 'letter' && (
        <>
          <rect x="8" y="10" width="48" height="32" rx="4" fill="#fff" stroke="#2b2063" strokeWidth="3" />
          <path d="m10 13 22 16 22-16" stroke="#e8902a" strokeWidth="3.5" fill="none" />
        </>
      )}
    </svg>
  )
}
