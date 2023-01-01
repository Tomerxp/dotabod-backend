import { t } from 'i18next'

import { DotaEvent, DotaEventTypes } from '../../types.js'
import { fmtMSS } from '../../utils/index.js'
import eventHandler from '../events/EventHandler.js'
import { GSIHandler } from '../GSIHandler.js'
import { server } from '../index.js'
import { getHeroNameById } from '../lib/heroes.js'
import { isPlayingMatch } from '../lib/isPlayingMatch.js'

eventHandler.registerEvent(`event:${DotaEventTypes.AegisPickedUp}`, {
  handler: (dotaClient: GSIHandler, event: DotaEvent) => {
    if (!isPlayingMatch(dotaClient.client.gsi)) return
    if (!dotaClient.client.stream_online) return

    const gameTimeDiff =
      (dotaClient.client.gsi?.map?.game_time ?? event.game_time) - event.game_time

    // expire for aegis in 5 minutes
    const expireS = 5 * 60 - gameTimeDiff
    const expireTime = (dotaClient.client.gsi?.map?.clock_time ?? 0) + expireS

    // server time
    const expireDate = dotaClient.addSecondsToNow(expireS)

    const res = {
      expireS,
      playerId: event.player_id,
      expireTime: fmtMSS(expireTime),
      expireDate,
    }

    dotaClient.aegisPickedUp = res

    const heroName = getHeroNameById(
      dotaClient.players?.matchPlayers[event.player_id].heroid ?? 0,
      event.player_id,
    )

    dotaClient.say(t('aegis.pickup', { lng: dotaClient.client.locale, heroName }), { beta: true })

    server.io.to(dotaClient.getToken()).emit('aegis-picked-up', res)
  },
})
