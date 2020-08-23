import {
  DEFAULT_TABLE_NAME,
  DEFAULT_RCU,
  DEFAULT_WCU,
  DEFAULT_CALLBACK,
  DEFAULT_HASH_KEY,
  DEFAULT_HASH_PREFIX,
  DEFAULT_TTL,
  DEFAULT_TOUCH_INTERVAL,
  DEFAULT_KEEP_EXPIRED_POLICY,
  DEFAULT_NEO4J_URL,
  DEFAULT_NEO4J_USER,
  DEFAULT_NEO4J_PWD
} from '../lib/constants';

describe('constants', () => {
  it('should have all the constants', () => {
    //expect(API_VERSION).toBeDefined();
    expect(DEFAULT_TOUCH_INTERVAL).toBeDefined();
    expect(DEFAULT_TTL).toBeDefined();
    expect(DEFAULT_HASH_PREFIX).toBeDefined();
    expect(DEFAULT_HASH_KEY).toBeDefined();
    expect(DEFAULT_CALLBACK).toBeDefined();
    expect(DEFAULT_WCU).toBeDefined();
    expect(DEFAULT_RCU).toBeDefined();
    expect(DEFAULT_TABLE_NAME).toBeDefined();
    expect(DEFAULT_KEEP_EXPIRED_POLICY).toBeDefined();
    expect(DEFAULT_NEO4J_URL).toBeDefined();
    expect(DEFAULT_NEO4J_USER).toBeDefined();
    expect(DEFAULT_NEO4J_PWD).toBeDefined();
  });

  it('default callback raises the appropriate error', () =>
    expect(() => {
      DEFAULT_CALLBACK('AN ERROR');
    }).toThrow('AN ERROR'));

  it('default callback raises the appropriate error', () => {
    DEFAULT_CALLBACK(null);
  });
});