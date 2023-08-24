import { DBSettings, getValueOrDefault } from '@dotabod/settings'
import { t } from 'i18next'

import { DotaEvent, DotaEventTypes } from '../../../types.js'
import { GSIHandler, say } from '../../GSIHandler.js'
import { getHeroNameById } from '../../lib/heroes.js'
import { isPlayingMatch } from '../../lib/isPlayingMatch.js'
import eventHandler from '../EventHandler.js'

eventHandler.registerEvent(`event:${DotaEventTypes.AegisDenied}`, {
  handler: (dotaClient: GSIHandler, event: DotaEvent) => {
    if (!isPlayingMatch(dotaClient.client.gsi)) return
    if (!dotaClient.client.stream_online) return

    const heroName = getHeroNameById(
      dotaClient.players?.matchPlayers[event.player_id].heroid ?? 0,
      event.player_id,
    )

    const chattersEnabled = getValueOrDefault(DBSettings.chatter, dotaClient.client.settings)
    const {
      roshDeny: { enabled: chatterEnabled },
    } = getValueOrDefault(DBSettings.chatters, dotaClient.client.settings)

    if (chattersEnabled && chatterEnabled)
      say(
        dotaClient.client,
        t('aegis.denied', { lng: dotaClient.client.locale, heroName, emote: 'ICANT' }),
      )
  },
})
