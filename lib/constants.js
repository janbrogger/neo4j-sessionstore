// @flow

// defaults
export const DEFAULT_TABLE_NAME: string = "sessions";
export const DEFAULT_HASH_KEY: string = "sessionId";
export const DEFAULT_HASH_PREFIX: string = "sess:";
export const DEFAULT_RCU: number = 5;
export const DEFAULT_WCU: number = 5;
export const DEFAULT_TTL: number = 86400000; // 1 day
export const DEFAULT_TOUCH_INTERVAL: number = 30000; // 30 seconds
export const DEFAULT_KEEP_EXPIRED_POLICY: boolean = false;
export const DEFAULT_CALLBACK = (err: Error) => {
  if (err) {
    throw err;
  }
};
// @flow
