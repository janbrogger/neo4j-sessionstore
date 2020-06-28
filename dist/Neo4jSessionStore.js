"use strict";Object.defineProperty(exports,"__esModule",{value:true});exports.default=void 0;var _expressSession=require("express-session");var _constants=require("./constants");var _util=require("./util");class Neo4jSessionStore extends _expressSession.Store{constructor(options={},callback=_constants.DEFAULT_CALLBACK){super();(0,_util.debug)("Initializing store",options);this.setOptionsAsInstanceAttributes(options);const neo4jConfig=options.neo4jConfig||{};this.createTableIfDontExists(callback)}setOptionsAsInstanceAttributes(options){const{table={},touchInterval=_constants.DEFAULT_TOUCH_INTERVAL,ttl,keepExpired=_constants.DEFAULT_KEEP_EXPIRED_POLICY}=options;const{name=_constants.DEFAULT_TABLE_NAME,hashPrefix=_constants.DEFAULT_HASH_PREFIX,hashKey=_constants.DEFAULT_HASH_KEY}=table;this.tableName=name;this.hashPrefix=hashPrefix;this.hashKey=hashKey;this.touchInterval=touchInterval;this.ttl=ttl;this.keepExpired=keepExpired}async isTableCreated(){try{await Promise.resolve(false);return true}catch(tableNotFoundError){return false}}createTable(){return Promise.resolve(false)}async createTableIfDontExists(callback){try{const exists=await this.isTableCreated();if(exists){(0,_util.debug)(`Table ${this.tableName} already exists`)}else{(0,_util.debug)(`Creating table ${this.tableName}...`);await this.createTable()}callback()}catch(createTableError){(0,_util.debug)(`Error creating table ${this.tableName}`,createTableError);callback(createTableError)}}set(sid,sess,callback){try{const sessionId=this.getSessionId(sid);const expires=this.getExpirationDate(sess);(0,_util.debug)(`Saving session '${sid}'`,sess)}catch(err){(0,_util.debug)("Error saving session",{sid,sess,err});callback(err)}}async get(sid,callback){try{const sessionId=this.getSessionId(sid);const record=await Promise.resolve(null);if(!record){(0,_util.debug)(`Session '${sid}' not found`);callback(null,null)}else if((0,_util.isExpired)(record.expires)){this.handleExpiredSession(sid,callback)}else{(0,_util.debug)(`Session '${sid}' found`,record.sess);callback(null,record.sess)}}catch(err){(0,_util.debug)(`Error getting session '${sid}'`,err);callback(err)}}async destroy(sid,callback){try{const sessionId=this.getSessionId(sid);await Promise.resolve(null);(0,_util.debug)(`Destroyed session '${sid}'`);callback(null,null)}catch(err){(0,_util.debug)(`Error destroying session '${sid}'`,err);callback(err)}}touch(sid,sess,callback){try{if(!sess.updated||Number(sess.updated)+this.touchInterval<=Date.now()){const sessionId=this.getSessionId(sid);const expires=this.getExpirationDate(sess);(0,_util.debug)(`Touching session '${sid}'`)}else{(0,_util.debug)(`Skipping touch of session '${sid}'`);callback()}}catch(err){(0,_util.debug)(`Error touching session '${sid}'`,err);callback(err)}}async handleExpiredSession(sid,callback){(0,_util.debug)(`Found session '${sid}' but it is expired`);if(this.keepExpired){callback(null,null)}else{this.destroy(sid,callback)}}getSessionId(sid){return`${this.hashPrefix}${sid}`}getExpirationDate(sess){let expirationDate=Date.now();if(this.ttl!==undefined){expirationDate+=this.ttl}else if(sess.cookie&&Number.isInteger(sess.cookie.maxAge)){expirationDate+=sess.cookie.maxAge}else{expirationDate+=_constants.DEFAULT_TTL}return new Date(expirationDate)}}exports.default=Neo4jSessionStore;