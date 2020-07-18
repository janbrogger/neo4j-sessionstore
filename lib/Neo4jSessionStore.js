// @flow

import { Store } from "express-session";
//import { neo4j } from 'neo4j-driver';
const neo4j = require("neo4j-driver");
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
  DEFAULT_NEO4J_PWD,
} from "./constants";
import { toSecondsEpoch, fromSecondsEpoch, debug, isExpired } from "./util";

/**
 * Express.js session store for Neo4j.
 */
export default class Neo4jSessionStore extends Store {
  /**
   * Constructor.
   * @param  {Object} options                Store
   * @param  {Function} callback Optional callback for table creation.
   */
  constructor(options?: Object = {}, callback?: Function = DEFAULT_CALLBACK) {
    super();
    debug("Initializing store", options);

    this.setOptionsAsInstanceAttributes(options);

    const neo4jConfig = options.neo4jConfig || {};

    this.neo4jauth = neo4j.auth.basic(this.neo4juser, this.neo4jpwd);
    this.neo4jdriver = neo4j.driver(this.neo4jurl, this.neo4jauth);

    // creates the table if necessary
    this.createTableIfDontExists(callback);

    process.on("exit", (code) => {
      this.neo4jsession.close();
      this.neo4jdriver.close();
    });
  }

  /**
   * Saves the informed store options as instance attributes.
   * @param {Object} options Store options.
   */
  setOptionsAsInstanceAttributes(options: Object): void {
    const {
      touchInterval = DEFAULT_TOUCH_INTERVAL,
      ttl,
      keepExpired = DEFAULT_KEEP_EXPIRED_POLICY,
      table = {},
      neo4jConfig: {
        neo4jurl = DEFAULT_NEO4J_URL,
        neo4juser = DEFAULT_NEO4J_USER,
        neo4jpwd = DEFAULT_NEO4J_PWD,
      },
    } = options;

    const {
      name = DEFAULT_TABLE_NAME,
      hashPrefix = DEFAULT_HASH_PREFIX,
      hashKey = DEFAULT_HASH_KEY,
    } = table;

    this.tableName = name;
    this.hashPrefix = hashPrefix;
    this.hashKey = hashKey;

    this.touchInterval = touchInterval;
    this.ttl = ttl;
    this.keepExpired = keepExpired;

    this.neo4jurl = neo4jurl;
    this.neo4juser = neo4juser;
    this.neo4jpwd = neo4jpwd;
  }

  getNeo4jSession(): Object {
    // neo4j client configuration
    const neo4jsession = this.neo4jdriver.session();
    return neo4jsession;
  }

  closeNeo4jSession(neo4jsession: function): void {
    if (neo4jsession) neo4jsession.close();
  }

  /**
   * Checks if the sessions table already exists.
   */
  async isTableCreated(): Promise<boolean> {
    // attempt to get details from a table
    const queryString = `MATCH (n: ${this.tableName}) RETURN count(n) as nodecount;`;
    const neo4jsession = this.getNeo4jSession();

    return neo4jsession
      .run(queryString)
      .then((result) => {
        const nodeCountArray = result.records.map((record) => {
          return record.get("nodecount").toNumber();
        });
        this.closeNeo4jSession(neo4jsession);
        return nodeCountArray.some((nodeCount) => nodeCount > 0);
      })
      .catch((error) => {
        debug(`Caught error:${error.message}`);
        this.closeNeo4jSession(neo4jsession);
        return false;
      });
  }

  /**
   * Creates the session table.
   */
  createTable(): Promise<boolean> {
    const neo4jsession = this.getNeo4jSession();
    const props = {
      sessionId: "store-init",
      expires: Date.now(),
      updated: Date.now(),
      sess: "",
    };
    const queryString = `CREATE (n:${this.tableName} $props)  RETURN n;`;
    return neo4jsession
      .run(queryString, { props: props })
      .then(() => {
        this.closeNeo4jSession(neo4jsession);
        return true;
      })
      .catch((error) => {
        debug(`Caught error:${error.message}`);
        this.closeNeo4jSession(neo4jsession);
        return false;
      });
  }

  /**
   * Creates the session table. Does nothing if it already exists.
   * @param  {Function} callback Callback to be invoked at the end of the execution.
   */
  async createTableIfDontExists(callback: Function): Promise<void> {
    try {
      const exists = await this.isTableCreated();

      if (exists) {
        debug(`Table ${this.tableName} already exists`);
      } else {
        debug(`Creating table ${this.tableName}...`);
        await this.createTable();
      }

      callback();
    } catch (createTableError) {
      debug(`Error creating table ${this.tableName}`, createTableError);
      callback(createTableError);
    }
  }

  /**
   * Stores a session.
   * @param  {String}   sid      Session ID.
   * @param  {Object}   sess     The session object.
   * @param  {Function} callback Callback to be invoked at the end of the execution.
   */
  async set(sid: string, sess: Object, callback: Function): void {
    try {
      const sessionId = this.getSessionId(sid);
      const expires = this.getExpirationDate(sess);
      const neo4jsession = this.getNeo4jSession();
      sess.updated = Date.now();

      debug("Checking for existing session");
      await this.getSessionInternal(sid).then((result) => {
        if (result == null) {
          debug(`Saving session '${sid}'`, sess);
          const props = {
            sessionId: sessionId,
            expires: toSecondsEpoch(expires),
            sess: JSON.stringify(sess),
          };
          const queryString = `CREATE (n:${this.tableName} $props)  RETURN n;`;
          neo4jsession.run(queryString, { props: props }).then((result) => {
            this.closeNeo4jSession(neo4jsession);
            callback();
          });
        } else {
          const props2 = {
            sessionId: sessionId,
            expires: toSecondsEpoch(expires),
            sess: JSON.stringify(sess),
          };
          const queryString2 = `MATCH (n:${this.tableName}) WHERE n.sessionId=$sessionId SET n = $props RETURN n;`;
          neo4jsession
            .run(queryString2, { sessionId: sessionId, props: props2 })
            .then((result) => {
              this.closeNeo4jSession(neo4jsession);
              callback();
            });
        }
      });
    } catch (err) {
      debug("Error saving session", {
        sid,
        sess,
        err,
      });
      callback(err);
    }
  }

  /**
   * Retrieves a Neo4j record  from neo4j.
   * @param  {String}   sid      Session ID.
   * @returns Promise<{Object}> value a special session object
   */
  async getSessionInternal(sid: string): Promise<Object> {
    try {
      const sessionId = this.getSessionId(sid);

      debug(`Getting session '${sid}'`);
      const neo4jsession = this.getNeo4jSession();

      const queryString = `MATCH (n:${this.tableName}) WHERE n.sessionId=$sessionId RETURN n;`;
      var record;

      return neo4jsession.run(queryString, { sessionId: sessionId }).then((result) => {
        this.closeNeo4jSession(neo4jsession);

        if (result.records.length === 0) return null;
        else if (result.records.length > 1)
          throw new Error("More than one session matched");

        const sessionId = result.records.map((r) => {
          return r.get("n").properties["sessionId"];
        });
        const expires = fromSecondsEpoch(
          result.records.map((r) => {
            return r.get("n").properties["expires"];
          })
        );
        const sessRaw = result.records.map((r) => {
          return r.get("n").properties["sess"];
        });
        const sess = JSON.parse(sessRaw);

        const session = {
          sessionId: sessionId,
          expires: expires,
          sess: sess,
        };
        return session;
      });
    } catch (err) {
      debug(`Error getting session '${sid}'`, err);
      return null;
    }
  }

  /**
   * Retrieves a session from neo4j.
   * @param  {String}   sid      Session ID.
   * @param  {Function} callback Callback to be invoked at the end of the execution.
   */
  async get(sid: string, callback: Function): Promise<void> {
    try {
      const sessionId = this.getSessionId(sid);

      debug(`Getting session '${sid}'`);


      const session = await this.getSessionInternal(sid);


      if (!session) {
        debug(`Session '${sid}' not found`);
        callback(null, null);
      } else if (isExpired(toSecondsEpoch(session.expires))) {
        this.handleExpiredSession(sid, callback);
      } else {
        debug(`Session '${sid}' found`, session.sess);
        callback(null, session.sess);
      }
    } catch (err) {
      debug(`Error getting session '${sid}'`, err);
      callback(err);
    }
  }

  /**
   * Deletes a session from neo4j.
   * @param  {String}   sid      Session ID.
   * @param  {Function} callback Callback to be invoked at the end of the execution.
   */
  async destroy(sid: string, callback: Function): Promise<void> {
    try {
      const sessionId = this.getSessionId(sid);
      await Promise.resolve(null);
      debug(`Destroyed session '${sid}'`);
      callback(null, null);
    } catch (err) {
      debug(`Error destroying session '${sid}'`, err);
      callback(err);
    }
  }

  /**
   * Updates the expiration time of an existing session.
   * @param  {String}   sid      Session ID.
   * @param  {Object}   sess     The session object.
   * @param  {Function} callback Callback to be invoked at the end of the execution.
   */
  touch(sid: string, sess: Object, callback: Function): void {
    try {
      if (
        !sess.updated ||
        Number(sess.updated) + this.touchInterval <= Date.now()
      ) {
        const sessionId = this.getSessionId(sid);
        const expires = this.getExpirationDate(sess);
        debug(`Touching session '${sid}'`);
      } else {
        debug(`Skipping touch of session '${sid}'`);
        callback();
      }
    } catch (err) {
      debug(`Error touching session '${sid}'`, err);
      callback(err);
    }
  }

  /**
   * Handles get requests that found expired sessions.
   * @param  {String} sid Original session id.
   * @param  {Function} callback Callback to be invoked at the end of the execution.
   */
  async handleExpiredSession(sid: string, callback: Function): Promise<void> {
    debug(`Found session '${sid}' but it is expired`);
    if (this.keepExpired) {
      callback(null, null);
    } else {
      this.destroy(sid, callback);
    }
  }

  /**
   * Builds the session ID for storage.
   * @param  {String} sid Original session id.
   * @return {String}     Prefix + original session id.
   */
  getSessionId(sid: string): string {
    return `${this.hashPrefix}${sid}`;
  }

  /**
   * Calculates the session expiration date.
   * @param  {Object} sess The session object.
   * @return {Date}      the session expiration date.
   */
  getExpirationDate(sess: Object): Date {
    let expirationDate = Date.now();
    if (this.ttl !== undefined) {
      expirationDate += this.ttl;
    } else if (sess.cookie && Number.isInteger(sess.cookie.maxAge)) {
      expirationDate += sess.cookie.maxAge*1000;
    } else {
      expirationDate += DEFAULT_TTL;
    }
    return new Date(expirationDate);
  }

  /**
   * Closes the Neo4j connection.
   */
  close() {
    this.neo4jdriver.close();
  }
}
