import { delayedGames } from '../../../prisma/generated/mongoclient/index.js'
import { getHeroNameById, heroColors } from '../../dota/lib/heroes.js'
import { isPlayingMatch } from '../../dota/lib/isPlayingMatch.js'
import Mongo from '../../steam/mongo.js'
import CustomError from '../../utils/customError.js'
import { chatClient } from '../index.js'
import commandHandler, { MessageType } from '../lib/CommandHandler.js'

const mongo = await Mongo.connect()

export async function profileLink(currentMatchId: string, colors: string[]) {
  if (!currentMatchId) {
    throw new CustomError('Not in a match PauseChamp')
  }

  if (!colors.length) {
    throw new CustomError('Missing hero color. Try !stats blue')
  }

  // light blue can be an option
  const color = `${colors[0].toLowerCase().trim()}${
    colors[1]?.toLowerCase() === 'blue' ? 'blue' : ''
  }`
  const heroKey = heroColors.findIndex((heroColor) => heroColor.toLowerCase() === color)

  if (heroKey === -1) {
    throw new CustomError(`Invalid hero color. Must be one of ${heroColors.join(' ')}`)
  }

  const response = (await mongo
    .collection('delayedGames')
    .findOne({ 'match.match_id': currentMatchId })) as unknown as delayedGames

  if (!response) {
    throw new CustomError('Waiting for current match data PauseChamp')
  }

  const matchPlayers = response.teams.flatMap((team) => team.players)
  const player = matchPlayers[heroKey]

  return `Here's ${getHeroNameById(player.heroid, heroKey)}: dotabuff.com/players/${
    player.accountid
  }`
}

commandHandler.registerCommand('stats', {
  aliases: ['check', 'profile'],
  permission: 0,
  onlyOnline: true,
  cooldown: 15000,
  handler: (message: MessageType, args: string[]) => {
    const {
      channel: { name: channel, client },
    } = message
    // if (!getValueOrDefault(DBSettings.commandStats, client.settings)) {
    //   return
    // }

    if (!client.gsi?.map?.matchid) {
      void chatClient.say(channel, 'Not in a match PauseChamp')
      return
    }

    if (!isPlayingMatch(client.gsi)) {
      void chatClient.say(channel, 'Not playing PauseChamp')
      return
    }

    // TODO: Add name and hero to !profile
    profileLink(client.gsi.map.matchid, args)
      .then((desc) => {
        void chatClient.say(message.channel.name, desc)
      })
      .catch((e) => {
        void chatClient.say(message.channel.name, e?.message ?? 'Game was not found.')
      })
  },
})
