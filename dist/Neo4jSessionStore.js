"use strict";Object.defineProperty(exports,"__esModule",{value:true});exports.default=void 0;var _expressSession=require("express-session");var _constants=require("./constants");var _util=require("./util");const neo4j=require("neo4j-driver");class Neo4jSessionStore extends _expressSession.Store{constructor(options={},callback=_constants.DEFAULT_CALLBACK){super();(0,_util.debug)("Initializing store",options);this.setOptionsAsInstanceAttributes(options);const neo4jConfig=options.neo4jConfig||{};this.neo4jauth=neo4j.auth.basic(this.neo4juser,this.neo4jpwd);this.neo4jdriver=neo4j.driver(this.neo4jurl,this.neo4jauth);this.createTableIfDontExists(callback);process.on("exit",this.exitListen)}exitListen(code){if(this.neo4jsession){this.neo4jsession.close()}if(this.neo4jdriver.close){this.neo4jdriver.close()}}setOptionsAsInstanceAttributes(options){const{touchInterval=_constants.DEFAULT_TOUCH_INTERVAL,ttl,keepExpired=_constants.DEFAULT_KEEP_EXPIRED_POLICY,table={},neo4jConfig:{neo4jurl=_constants.DEFAULT_NEO4J_URL,neo4juser=_constants.DEFAULT_NEO4J_USER,neo4jpwd=_constants.DEFAULT_NEO4J_PWD}}=options;const{name=_constants.DEFAULT_TABLE_NAME,hashPrefix=_constants.DEFAULT_HASH_PREFIX,hashKey=_constants.DEFAULT_HASH_KEY}=table;this.tableName=name;this.hashPrefix=hashPrefix;this.hashKey=hashKey;this.touchInterval=touchInterval;this.ttl=ttl;this.keepExpired=keepExpired;this.neo4jurl=neo4jurl;this.neo4juser=neo4juser;this.neo4jpwd=neo4jpwd}getNeo4jSession(){const neo4jsession=this.neo4jdriver.session();return neo4jsession}closeNeo4jSession(neo4jsession){if(neo4jsession)neo4jsession.close()}isTableCreated(){const queryString=`MATCH (n: ${this.tableName}) RETURN count(n) as nodecount;`;const neo4jsession=this.getNeo4jSession();return neo4jsession.run(queryString).then(result=>{const nodeCountArray=result.records.map(record=>{return record.get("nodecount").toNumber()});this.closeNeo4jSession(neo4jsession);return nodeCountArray.some(nodeCount=>nodeCount>0)}).catch(error=>{(0,_util.debug)(`Caught error:${error.message}`);this.closeNeo4jSession(neo4jsession);throw error})}createTable(){const neo4jsession=this.getNeo4jSession();const props={sessionId:"store-init",expires:Date.now(),sess:""};const queryString=`CREATE (n:${this.tableName} $props)  RETURN n;`;return neo4jsession.run(queryString,{props:props}).then(()=>{this.closeNeo4jSession(neo4jsession);return true}).catch(error=>{(0,_util.debug)(`Caught error:${error.message}`);this.closeNeo4jSession(neo4jsession);throw error})}createTableIfDontExists(callback){return this.isTableCreated().then(exists=>{if(exists){(0,_util.debug)(`Table ${this.tableName} already exists`);callback();return false}else{(0,_util.debug)(`Creating table ${this.tableName}...`);return this.createTable().then(result=>{callback();return true})}}).catch(error=>{callback(error);return false})}async set(sid,sess,callback){try{const sessionId=this.getSessionId(sid);const expires=this.getExpirationDate(sess);const neo4jsession=this.getNeo4jSession();sess.updated=Date.now();(0,_util.debug)("Checking for existing session");await this.getSessionInternal(sid).then(result=>{if(result==null){(0,_util.debug)(`Saving session '${sid}'`,sess);const props={sessionId:sessionId,expires:(0,_util.toSecondsEpoch)(expires),sess:JSON.stringify(sess)};const queryString=`CREATE (n:${this.tableName} $props)  RETURN n;`;neo4jsession.run(queryString,{props:props}).then(result=>{this.closeNeo4jSession(neo4jsession);callback()})}else{const props2={sessionId:sessionId,expires:(0,_util.toSecondsEpoch)(expires),sess:JSON.stringify(sess)};const queryString2=`MATCH (n:${this.tableName}) WHERE n.sessionId=$sessionId SET n = $props RETURN n;`;neo4jsession.run(queryString2,{sessionId:sessionId,props:props2}).then(result=>{this.closeNeo4jSession(neo4jsession);callback()})}})}catch(err){(0,_util.debug)("Error saving session",{sid,sess,err});callback(err)}}async getSessionInternal(sid){try{const sessionId=this.getSessionId(sid);(0,_util.debug)(`Getting session '${sid}'`);const neo4jsession=this.getNeo4jSession();const queryString=`MATCH (n:${this.tableName}) WHERE n.sessionId=$sessionId RETURN n;`;var record;return neo4jsession.run(queryString,{sessionId:sessionId}).then(result=>{this.closeNeo4jSession(neo4jsession);if(result.records.length===0)return null;else if(result.records.length>1)throw new Error("More than one session matched");const sessionId=result.records.map(r=>{return r.get("n").properties["sessionId"]});const expires=(0,_util.fromSecondsEpoch)(result.records.map(r=>{return r.get("n").properties["expires"]}));const sessRaw=result.records.map(r=>{return r.get("n").properties["sess"]});const sess=JSON.parse(sessRaw);const session={sessionId:sessionId,expires:expires,sess:sess};return session})}catch(err){(0,_util.debug)(`Error getting session '${sid}'`,err);return null}}async get(sid,callback){try{const sessionId=this.getSessionId(sid);(0,_util.debug)(`Getting session '${sid}'`);const session=await this.getSessionInternal(sid);if(!session){(0,_util.debug)(`Session '${sid}' not found`);callback(null,null)}else if((0,_util.isExpired)((0,_util.toSecondsEpoch)(session.expires))){this.handleExpiredSession(sid,callback)}else{(0,_util.debug)(`Session '${sid}' found`,session.sess);callback(null,session.sess)}}catch(err){(0,_util.debug)(`Error getting session '${sid}'`,err);callback(err)}}async destroy(sid,callback){try{const sessionId=this.getSessionId(sid);const neo4jsession=this.getNeo4jSession();const queryString=`MATCH (n:${this.tableName}) WHERE n.sessionId=$sessionId DETACH DELETE n;`;return neo4jsession.run(queryString,{sessionId:sessionId}).then(result=>{this.closeNeo4jSession(neo4jsession);(0,_util.debug)(`Destroyed session '${sid}'`);callback(null,null)})}catch(err){(0,_util.debug)(`Error destroying session '${sid}'`,err);callback(err)}}touch(sid,sess,callback){try{if(!sess.updated||Number(sess.updated)+this.touchInterval<=Date.now()){(0,_util.debug)(`Touching session '${sid}'`);const sessionId=this.getSessionId(sid);const expires=this.getExpirationDate(sess);sess.updated=Date.now();const neo4jsession=this.getNeo4jSession();const queryString=`MATCH (n:${this.tableName}) WHERE n.sessionId="${sessionId}" SET n += $props;`;const props={expires:(0,_util.toSecondsEpoch)(expires),sess:JSON.stringify(sess)};return neo4jsession.run(queryString,{props:props}).then(result=>{this.closeNeo4jSession(neo4jsession);(0,_util.debug)(`Touched  session '${sid}'`);callback()}).catch(err=>{(0,_util.debug)(`Error touching session '${sid}'`,err);this.closeNeo4jSession(neo4jsession);callback(err)})}else{(0,_util.debug)(`Skipping touch of session '${sid}'`);callback()}}catch(err){(0,_util.debug)(`Error touching session '${sid}'`,err);callback(err)}}async handleExpiredSession(sid,callback){(0,_util.debug)(`Found session '${sid}' but it is expired`);if(this.keepExpired){callback(null,null)}else{this.destroy(sid,callback)}}getSessionId(sid){return`${this.hashPrefix}${sid}`}getExpirationDate(sess){let expirationDate=Date.now();if(this.ttl!==undefined){expirationDate+=this.ttl}else if(sess.cookie&&Number.isInteger(sess.cookie.maxAge)){expirationDate+=sess.cookie.maxAge*1000}else{expirationDate+=_constants.DEFAULT_TTL}return new Date(expirationDate)}close(){this.neo4jdriver.close();process.removeListener("exit",this.exitListen)}}exports.default=Neo4jSessionStore;