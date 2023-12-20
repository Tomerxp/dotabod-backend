import { RefreshingAuthProvider } from '@twurple/auth';
import supabase from '../../db/supabase.js';
import { logger } from '../../utils/logger.js';
import { hasTokens } from './hasTokens.js';
let authProvider = null;
export const getAuthProvider = function () {
    if (!hasTokens)
        throw new Error('Missing twitch tokens');
    if (authProvider)
        return authProvider;
    authProvider = new RefreshingAuthProvider({
        clientId: process.env.TWITCH_CLIENT_ID ?? '',
        clientSecret: process.env.TWITCH_CLIENT_SECRET ?? '',
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        onRefreshFailure: async (twitchId) => {
            logger.error('[TWITCHSETUP] Failed to refresh twitch tokens', { twitchId });
            await supabase
                .from('accounts')
                .update({
                requires_refresh: true,
            })
                .eq('providerAccountId', twitchId)
                .eq('provider', 'twitch');
        },
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        onRefresh: async (twitchId, newTokenData) => {
            logger.info('[TWITCHSETUP] Refreshing twitch tokens', { twitchId });
            await supabase
                .from('accounts')
                .update({
                scope: newTokenData.scope.join(' '),
                access_token: newTokenData.accessToken,
                refresh_token: newTokenData.refreshToken,
                expires_at: Math.floor(new Date(newTokenData.obtainmentTimestamp).getTime() / 1000 +
                    (newTokenData.expiresIn ?? 0)),
                expires_in: newTokenData.expiresIn ?? 0,
                obtainment_timestamp: new Date(newTokenData.obtainmentTimestamp).toISOString(),
            })
                .eq('providerAccountId', twitchId)
                .eq('provider', 'twitch');
        },
    });
    return authProvider;
};
//# sourceMappingURL=getAuthProvider.js.map