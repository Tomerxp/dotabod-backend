import { t } from 'i18next';
import supabase from '../../db/supabase.js';
import { server } from '../../dota/index.js';
import { logger } from '../../utils/logger.js';
import { chatClient } from '../chatClient.js';
import commandHandler from '../lib/CommandHandler.js';
commandHandler.registerCommand('resetwl', {
    permission: 2,
    cooldown: 0,
    handler: (message, args) => {
        async function handler() {
            const { channel: { name: channel, client }, } = message;
            await supabase
                .from('users')
                .update({
                stream_start_date: new Date().toISOString(),
            })
                .eq('id', message.channel.client.token);
            chatClient.say(channel, t('refresh', { lng: message.channel.client.locale }));
            server.io.to(client.token).emit('refresh');
            chatClient.say(message.channel.name, t('resetwl', {
                lng: message.channel.client.locale,
                channel: message.channel.name,
            }));
        }
        try {
            void handler();
        }
        catch (e) {
            logger.error('Error in resetwl command', e);
        }
    },
});
//# sourceMappingURL=resetwl.js.map