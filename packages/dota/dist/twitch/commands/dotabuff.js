import { DBSettings } from '@dotabod/settings';
import { t } from 'i18next';
import { chatClient } from '../chatClient.js';
import commandHandler from '../lib/CommandHandler.js';
commandHandler.registerCommand('dotabuff', {
    dbkey: DBSettings.commandDotabuff,
    handler: (message, args) => {
        const { channel: { name: channel, client }, } = message;
        if (client.steam32Id && Number(client.steam32Id)) {
            chatClient.say(channel, t('profileUrl', {
                channel: client.name,
                lng: message.channel.client.locale,
                url: `dotabuff.com/players/${client.steam32Id.toString()}`,
            }));
            return;
        }
        chatClient.say(channel, message.channel.client.multiAccount
            ? t('multiAccount', {
                lng: message.channel.client.locale,
                url: 'dotabod.com/dashboard/features',
            })
            : t('unknownSteam', { lng: message.channel.client.locale }));
    },
});
//# sourceMappingURL=dotabuff.js.map