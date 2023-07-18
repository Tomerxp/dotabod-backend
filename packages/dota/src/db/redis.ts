import { createClient } from 'redis'

import { logger } from '../utils/logger.js'

export default class RedisClient {
  private static instance: RedisClient
  public client: ReturnType<typeof createClient>
  public subscriber: ReturnType<typeof createClient>

  private constructor() {
    this.client = createClient({ url: 'redis://redis:6379' })
    this.subscriber = this.client.duplicate()

    this.client.on('error', (err: any) => {
      if (err?.code !== 'ENOTFOUND') return logger.error('Redis Client Error', { err })
    })
    this.client.once('connect', () => {
      logger.info('[REDIS] Redis client connected')
    })
  }

  public async connectClient(): Promise<ReturnType<typeof createClient>> {
    try {
      await this.client.connect()
      return this.client
    } catch (error) {
      logger.error('REDIS CONNECT ERR', { error })
      throw error
    }
  }

  public async connectSubscriber(): Promise<ReturnType<typeof createClient>> {
    try {
      await this.subscriber.connect()
      return this.subscriber
    } catch (error) {
      logger.error('REDIS CONNECT ERR', { error })
      throw error
    }
  }

  public static getInstance(): RedisClient {
    if (!RedisClient.instance) RedisClient.instance = new RedisClient()
    return RedisClient.instance
  }
}
