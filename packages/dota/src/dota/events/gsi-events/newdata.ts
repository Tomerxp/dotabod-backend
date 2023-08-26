import { DBSettings, getValueOrDefault } from '@dotabod/settings'
import { t } from 'i18next'

import { Packet, SocketClient, validEventTypes } from '../../../types.js'
import { logger } from '../../../utils/logger.js'
import { events } from '../../globalEventEmitter.js'
import { GSIHandler, redisClient, say } from '../../GSIHandler.js'
import { server } from '../../index.js'
import { checkPassiveMidas } from '../../lib/checkMidas.js'
import { checkPassiveTp } from '../../lib/checkPassiveTp.js'
import { calculateManaSaved } from '../../lib/checkTreadToggle.js'
import { DelayedCommands } from '../../lib/consts.js'
import { isPlayingMatch } from '../../lib/isPlayingMatch.js'
import eventHandler from '../EventHandler.js'
import minimapParser from '../minimap/parser.js'

function chatterMatchFound(client: SocketClient) {
  if (!client.stream_online) return

  const commands = DelayedCommands.filter((cmd) => getValueOrDefault(cmd.key, client.settings))

  const chattersEnabled = getValueOrDefault(DBSettings.chatter, client.settings)
  const {
    commandsReady: { enabled: chatterEnabled },
  } = getValueOrDefault(DBSettings.chatters, client.settings)

  if (commands.length && chattersEnabled && chatterEnabled) {
    say(
      client,
      t('matchFound', {
        commandList: commands.map((c) => c.command).join(' · '),
        lng: client.locale,
      }),
      {
        delay: false,
      },
    )
  }
}

const steamServerLookupMap = new Map()
const steamDelayDataLookupMap = new Map()

// Runs every gametick
async function saveMatchData(client: SocketClient) {
  // This now waits for the bet to complete before checking match data
  // Since match data is delayed it will run far fewer than before, when checking actual match id of an ingame match
  // the playingBetMatchId is saved when the hero is selected
  const betsForMatchId = await redisClient.client.get(`${client.token}:betsForMatchId`)
  if (!Number(betsForMatchId)) return

  if (!client.steam32Id) return

  // did we already come here before?
  let [steamServerId, lobbyType] = await redisClient.client
    .multi()
    .get(`${betsForMatchId}:steamServerId`)
    .get(`${betsForMatchId}:lobbyType`)
    .exec()

  if (steamServerId && lobbyType) return

  if (!steamServerId && !lobbyType) {
    if (steamServerLookupMap.has(betsForMatchId)) return

    const promise = server.dota.getUserSteamServer(client.steam32Id)
    steamServerLookupMap.set(betsForMatchId, promise)
    steamServerId = await promise
    steamServerLookupMap.delete(betsForMatchId) // Remove the promise once it's resolved

    if (!steamServerId) return
    await redisClient.client.set(`${betsForMatchId}:steamServerId`, steamServerId.toString())
  }

  if (steamServerId && !lobbyType) {
    if (steamDelayDataLookupMap.has(betsForMatchId)) return

    const promise = server.dota.GetRealTimeStats({
      match_id: betsForMatchId!,
      refetchCards: true,
      steam_server_id: steamServerId.toString(),
      token: client.token,
    })
    steamDelayDataLookupMap.set(betsForMatchId, promise)
    const delayedData = await promise
    steamDelayDataLookupMap.delete(betsForMatchId) // Remove the promise once it's resolved

    if (!delayedData?.match.lobby_type) return
    await redisClient.client.set(`${betsForMatchId}:lobbyType`, delayedData.match.lobby_type)
    chatterMatchFound(client)
  }
}

// Catch all
eventHandler.registerEvent(`newdata`, {
  handler: async (dotaClient: GSIHandler, data: Packet) => {
    // New users who dont have a steamaccount saved yet
    // This needs to run first so we have client.steamid on multiple acts
    await dotaClient.updateSteam32Id()

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
    const playingHeroSlot = Number(
      await redisClient.client.get(`${dotaClient.client.token}:playingHeroSlot`),
    )
    if (!(playingHeroSlot >= 0) && typeof purchaser === 'number') {
      await redisClient.client.set(`${dotaClient.client.token}:playingHeroSlot`, purchaser)
      await saveMatchData(dotaClient.client)
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

    // saveMatchData checks and returns early if steam is found
    await saveMatchData(dotaClient.client)

    handleNewEvents(data, dotaClient)

    await dotaClient.openBets(dotaClient.client)

    await checkPassiveMidas(dotaClient.client)
    await checkPassiveTp(dotaClient.client)
  },
})

function handleNewEvents(data: Packet, dotaClient: GSIHandler) {
  // Create a set for faster lookup of existing events
  const existingEventsSet = new Set(dotaClient.events.map((e) => `${e.game_time}-${e.event_type}`))

  // Filter new events
  const newEvents = data.events?.filter(
    ({ game_time, event_type }) => !existingEventsSet.has(`${game_time}-${event_type}`),
  )

  if (newEvents?.length) {
    // Merge new and existing events
    dotaClient.events = [...dotaClient.events, ...newEvents]

    // Emit events and log if necessary
    newEvents.forEach((event) => {
      events.emit(`event:${event.event_type}`, event, dotaClient.client.token)
      if (!validEventTypes.has(event.event_type)) {
        logger.info('[NEWEVENT]', event)
      }
    })
  }
}
