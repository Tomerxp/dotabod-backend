import RedisClient from '../../../db/RedisClient.js';
import { logger } from '../../../utils/logger.js';
import { server } from '../../index.js';
import { isPlayingMatch } from '../../lib/isPlayingMatch.js';
import eventHandler from '../EventHandler.js';
// TODO: check kill list value
eventHandler.registerEvent(`player:kill_list`, {
    handler: async (dotaClient, kill_list) => {
        if (!dotaClient.client.stream_online)
            return;
        if (!isPlayingMatch(dotaClient.client.gsi))
            return;
        const redisClient = RedisClient.getInstance();
        const redisJson = (await redisClient.client.json.get(`${dotaClient.getToken()}:aegis`));
        if (typeof redisJson?.playerId !== 'number')
            return;
        // Remove aegis icon from the player we just killed
        if (Object.values(kill_list).includes(redisJson.playerId)) {
            try {
                void redisClient.client.json.del(`${dotaClient.getToken()}:aegis`);
            }
            catch (e) {
                logger.error('err redisClient aegis del', { e });
            }
            server.io.to(dotaClient.getToken()).emit('aegis-picked-up', {});
        }
    },
});
//# sourceMappingURL=player.kill_list.js.map