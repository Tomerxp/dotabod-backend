import { DBSettings, getValueOrDefault } from '../../db/settings.js'
import { isPlayingMatch } from '../../dota/lib/isPlayingMatch.js'
import commandHandler, { MessageType } from './CommandHandler.js'

import { chatClient } from './index.js'

commandHandler.registerCommand('gpm', {
  aliases: [],
  permission: 0,
  cooldown: 15000,
  handler: (message: MessageType, args: string[]) => {
    const {
      channel: { name: channel, client },
    } = message
    if (!getValueOrDefault(DBSettings.commandGPM, message.channel.client.settings)) {
      return
    }

    if (!client.gsi?.gamestate?.hero?.name || !isPlayingMatch(client.gsi)) {
      void chatClient.say(channel, 'Not playing PauseChamp')
      return
    }

    const gpm = client.gsi.gamestate.player?.gpm

    if (!gpm) {
      void chatClient.say(channel, 'Live GPM: 0')
      return
    }

    const gold_from_hero_kills = client.gsi.gamestate.player?.gold_from_hero_kills
    const gold_from_creep_kills = client.gsi.gamestate.player?.gold_from_creep_kills

    void chatClient.say(
      channel,
      `Live GPM: ${gpm}. ${gold_from_hero_kills ?? 0} from hero kills, ${
        gold_from_creep_kills ?? 0
      } from creep kills.`,
    )
  },
})