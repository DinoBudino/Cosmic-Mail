import { getDestination } from '../data/destinations'
import { ACTIVE_MISSION_IDS, getMission } from '../data/missions'
import { getPassportView } from '../data/passport'
import type { JourneySave } from '../store/journeySchema'
import type { KeepsakeData } from './keepsakes'

/** Landing year of an explorer, from its mission year label ("1976–1982" → "1976"). */
function landingYear(yearLabel: string): string {
  return yearLabel.slice(0, 4)
}

/** Everything the certificate and the postcard show, from the journey save. */
export function keepsakeDataFor(save: JourneySave | null, now = new Date()): KeepsakeData {
  const view = getPassportView(save)
  return {
    carrierName: view.carrierName || 'Carrier',
    carrierId: view.carrierId,
    date: now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    explorers: ACTIVE_MISSION_IDS.map((id) => {
      const mission = getMission(id)
      return {
        name: mission.machineName,
        world: getDestination(mission.destination).name === 'Moon' ? ('Moon' as const) : ('Mars' as const),
        year: landingYear(mission.yearLabel),
      }
    }),
  }
}
