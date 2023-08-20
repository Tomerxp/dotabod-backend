import { DBSettings, getValueOrDefault } from '@dotabod/settings'
import { t } from 'i18next'

import { DotaEventTypes, Packet } from '../../../types.js'
import { logger } from '../../../utils/logger.js'
import { events } from '../../globalEventEmitter.js'
import { GSIHandler } from '../../GSIHandler.js'
import checkMidas from '../../lib/checkMidas.js'
import { calculateManaSaved } from '../../lib/checkTreadToggle.js'
import { isPlayingMatch } from '../../lib/isPlayingMatch.js'
import eventHandler from '../EventHandler.js'
import minimapParser from '../minimap/parser.js'

// Catch all
eventHandler.registerEvent(`newdata`, {
  handler: async (dotaClient: GSIHandler, data: Packet) => {
    // New users who dont have a steamaccount saved yet
    // This needs to run first so we have client.steamid on multiple acts
    dotaClient.updateSteam32Id()

    // In case they connect to a game in progress and we missed the start event
    await dotaClient.setupOBSBlockers(data.map?.game_state ?? '')

    if (!isPlayingMatch(dotaClient.client.gsi)) return

    // Everything below here requires an ongoing match, not a finished match
    const hasWon =
      dotaClient.client.gsi?.map?.win_team && dotaClient.client.gsi.map.win_team !== 'none'
    if (hasWon) return

    // only if they're in a match ^ and they're a beta tester
    if (dotaClient.client.beta_tester && dotaClient.client.stream_online) {
      const enabled = getValueOrDefault(DBSettings['minimap-blocker'], dotaClient.client.settings)
      if (enabled) minimapParser.init(data, dotaClient.mapBlocker)
    }

    // Can't just !dotaClient.heroSlot because it can be 0
    const purchaser = dotaClient.client.gsi?.items?.teleport0?.purchaser
    if (typeof dotaClient.playingHeroSlot !== 'number' && typeof purchaser === 'number') {
      dotaClient.playingHeroSlot = purchaser
      try {
        void dotaClient.saveMatchData()
      } catch (e) {
        logger.error('saveMatchData', { e })
      }
      return
    }

    const chattersEnabled = getValueOrDefault(DBSettings.chatter, dotaClient.client.settings)
    const {
      powerTreads: { enabled: treadsChatterEnabled },
    } = getValueOrDefault(DBSettings.chatters, dotaClient.client.settings)
    if (chattersEnabled && treadsChatterEnabled) {
      try {
        void calculateManaSaved(dotaClient)
      } catch (e) {
        logger.error('err calculateManaSaved', { e })
      }
    }

    // Always runs but only until steam is found
    try {
      void dotaClient.saveMatchData()
    } catch (e) {
      logger.error('err saveMatchData', { e })
    }

    // TODO: Move this to server.ts
    const newEvents = data.events?.filter((event) => {
      const existingEvent = dotaClient.events.find(
        (e) => e.game_time === event.game_time && e.event_type === event.event_type,
      )
      return !existingEvent
    })

    if (newEvents?.length) {
      dotaClient.events = [...dotaClient.events, ...newEvents]

      newEvents.forEach((event) => {
        events.emit(`event:${event.event_type}`, event, dotaClient.getToken())

        if (!Object.values(DotaEventTypes).includes(event.event_type)) {
          logger.info('[NEWEVENT]', event)
        }
      })
    }

    await dotaClient.openBets()

    const {
      midas: { enabled: midasChatterEnabled },
    } = getValueOrDefault(DBSettings.chatters, dotaClient.client.settings)
    if (chattersEnabled && midasChatterEnabled && dotaClient.client.stream_online) {
      const isMidasPassive = checkMidas(data, dotaClient.passiveMidas)

      if (typeof isMidasPassive === 'number') {
        dotaClient.say(
          t('midasUsed', {
            emote: 'Madge',
            lng: dotaClient.client.locale,
            seconds: isMidasPassive,
          }),
        )
        return
      }

      if (isMidasPassive) {
        logger.info('[MIDAS] Passive midas', { name: dotaClient.getChannel() })
        dotaClient.say(
          t('chatters.midas', { emote: 'massivePIDAS', lng: dotaClient.client.locale }),
        )
        return
      }
    }
  },
})
