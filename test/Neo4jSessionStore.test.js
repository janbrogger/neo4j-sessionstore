import uuidv4 from "uuid/v4";
import Neo4jSessionStore from "../lib/Neo4jSessionStore";
import { toSecondsEpoch } from "../lib/util";
import { DEFAULT_TABLE_NAME, DEFAULT_TTL } from "../lib/constants";
import { execSync } from "child_process";
const neo4j = require("neo4j-driver");

const TEST_OPTIONS = {
  table: {
    name: "test-sessions",
    hashKey: "test-sessionId",
    hashPrefix: "test:",
  },
  neo4jConfig: {
    neo4jurl: "bolt://localhost:7687",
    neo4juser: "neo4j",
    neo4jpwd: "test",
  },
  touchInterval: 0,
};

/* beforeAll(async () => {
  // TODO: setup test environment by creating a test table

  var neo4jTestContainerExists = false;
  const output1 = execSync("docker ps -a --filter 'name=testneo4j' | wc -l")
    .toString()
    .trimRight();
  if (output1 === "2") {
    //console.log("Found test neo4j container");
    neo4jTestContainerExists = true;
  }

  var neo4jTestContainerRuns = false;
  const output2 = execSync("docker ps --filter 'name=testneo4j' | wc -l")
    .toString()
    .trimRight();
  if (output2 === "2") {
    //console.log("Found running test neo4j container");
    neo4jTestContainerRuns = true;
  }

  //console.log(`Test container exists: ${neo4jTestContainerExists}`);
  //console.log(`Test container runs: ${neo4jTestContainerRuns}`);

  if (neo4jTestContainerExists & !neo4jTestContainerRuns) {
    //console.log('Starting stopped test neo4j container');
    execSync("docker start testneo4j");
  } else if (!neo4jTestContainerExists) {
    //console.log('Starting a new test neo4j container');
    const neo4jDockerCommand =
      "docker run " +
      "--name testneo4j " +
      "-p7474:7474 -p7687:7687 " +
      "--env NEO4J_AUTH=neo4j/test " +
      "-d  neo4j:latest";

    execSync(neo4jDockerCommand);
  }

  const neo4jurl = TEST_OPTIONS.neo4jConfig.neo4jurl;
  const neo4juser = TEST_OPTIONS.neo4jConfig.neo4juser;
  const neo4jpwd = TEST_OPTIONS.neo4jConfig.neo4jpwd;
  const neo4jauth = neo4j.auth.basic(neo4juser, neo4jpwd);
  const neo4jdriver = neo4j.driver(neo4jurl, neo4jauth);
  const neo4jsession = neo4jdriver.session();
  const queryString = "MATCH (n) DELETE (n);";
  return neo4jsession.run(queryString);
}); */

 afterAll( async  () => {
  const neo4jurl = TEST_OPTIONS.neo4jConfig.neo4jurl;
  const neo4juser = TEST_OPTIONS.neo4jConfig.neo4juser;
  const neo4jpwd = TEST_OPTIONS.neo4jConfig.neo4jpwd;
  const neo4jauth = neo4j.auth.basic(neo4juser, neo4jpwd);
  const neo4jdriver = neo4j.driver(neo4jurl, neo4jauth);
  const neo4jsession = neo4jdriver.session();
  const queryString = "MATCH (n) DELETE (n);";
  await neo4jsession.
    run(queryString)
    .then((result) => {
      neo4jsession.close()
      neo4jdriver.close();
    });
}); 

describe("Neo4jSessionStore", () => {
  it("Database connectivity test", () =>
    new Promise((resolve, reject) => {
      const neo4jurl = TEST_OPTIONS.neo4jConfig.neo4jurl;
      const neo4juser = TEST_OPTIONS.neo4jConfig.neo4juser;
      const neo4jpwd = TEST_OPTIONS.neo4jConfig.neo4jpwd;
      try {
        const neo4jauth = neo4j.auth.basic(neo4juser, neo4jpwd);
        const neo4jdriver = neo4j.driver(neo4jurl, neo4jauth);
        const neo4jsession = neo4jdriver.session();
        const queryString = "MATCH (n) RETURN count(n) as nodecount;";
        neo4jsession.run(queryString).then((result) => {
          result.records.map((record) => {
            var nodecount = record.get("nodecount").toNumber();
            neo4jsession.close();
            neo4jdriver.close();
            expect(nodecount).toBe(0);
            resolve();
          });
        });
      } catch (error) {
        neo4jsession.close();
        neo4jdriver.close();
        reject(error);
      }
    })
  );

  /* it("should create a store and a new table", () =>
    new Promise((resolve, reject) => {
      const options = {
        table: {
          name: "testsessionsnew",
          hashKey: "testsessionId",
          hashPrefix: "test:",
        },
        neo4jConfig: TEST_OPTIONS.neo4jConfig,
      };
      const neo4jurl = options.neo4jConfig.neo4jurl;
      const neo4juser = options.neo4jConfig.neo4juser;
      const neo4jpwd = options.neo4jConfig.neo4jpwd;

      const store = new Neo4jSessionStore(options, (err) => {
        let neo4jsession;
        let neo4jdriver;

        expect(err).toBeUndefined();
        try {
          const neo4jauth = neo4j.auth.basic(neo4juser, neo4jpwd);
          neo4jdriver = neo4j.driver(neo4jurl, neo4jauth);
          neo4jsession = neo4jdriver.session();

          const queryString = "MATCH (n) RETURN count(n) as nodecount;";
          return neo4jsession
            .run(queryString)
            .then((result) => {
              var nodecount;
              result.records.map((record) => {
                nodecount = record.get("nodecount").toNumber();
              });
              if (neo4jsession) neo4jsession.close();
              if (neo4jdriver) neo4jdriver.close();
              expect(nodecount).toBe(1);
            })
            .then(() => {
              expect(store).toBeDefined();
              resolve();
            });
        } catch (error) {
          reject(error);
        }
      });
    })); */
});
/*
  it('should create a store using an existing table', () =>
    new Promise((resolve, reject) => {
      const store = new Neo4jSessionStore(TEST_OPTIONS, (err) => {
        if (err) reject(err);
        else resolve();
      });
      expect(store).toBeDefined();
    }));

  it('should create a store with default table values', () =>
    new Promise((resolve, reject) => {
      const options = { neo4jConfig: TEST_OPTIONS.neo4jConfig };
      const store = new Neo4jSessionStore(options, (err) => {
        try {
          expect(err).toBeUndefined();
          resolve();
        } catch (error) {
          reject(error);
        } finally {
          // TODO: delete the table
        }
      });
      expect(store).toBeDefined();
    }));

  it('should create session with default ttl', () =>
    new Promise((resolve, reject) => {
      const store = new Neo4jSessionStore(
        {
          ...TEST_OPTIONS,
          ttl: undefined,
        },
        (err) => {
          if (err) reject(err);
        },
      );
      const sessionId = uuidv4();
      const name = uuidv4();
      store.set(sessionId, { name }, async (err) => {
        try {
          if (err) reject(err);
          else {
            const params = {
              TableName: TEST_OPTIONS.table.name,
              Key: {
                [TEST_OPTIONS.table.hashKey]: `${TEST_OPTIONS.table.hashPrefix}${sessionId}`,
              },
            };
            const sessionRow = await documentClient.get(params).promise();
            expect(sessionRow).toBeDefined();
            expect(sessionRow.Item).toBeDefined();
            expect(sessionRow.Item.expires).toBeDefined();
            expect(Number.isInteger(sessionRow.Item.expires)).toBeTruthy();
            // make sure it's in the seconds epoch
            expect(String(sessionRow.Item.expires).length).toBe(
              String(toSecondsEpoch(new Date())).length,
            );
            // future date
            expect(sessionRow.Item.expires).toBeGreaterThan(toSecondsEpoch(new Date()));
            // should be before the default ttl limit
            expect(sessionRow.Item.expires).toBeLessThanOrEqual(
              toSecondsEpoch(new Date(Date.now() + DEFAULT_TTL)),
            );
            // after 10 seconds before the limit (assuming test execution time < 5 seconds)
            expect(sessionRow.Item.expires).toBeGreaterThan(
              // eslint-disable-next-line
              toSecondsEpoch(new Date(Date.now() + DEFAULT_TTL - 10000)),
            );
            expect(sessionRow.Item.sess).toBeDefined();
            expect(sessionRow.Item.sess.name).toBe(name);
            resolve();
          }
        } catch (error) {
          reject(error);
        }
      });
    }));

  it('should create session using the cookie maxAge', () =>
    new Promise((resolve, reject) => {
      const store = new Neo4jSessionStore(TEST_OPTIONS, (err) => {
        if (err) reject(err);
      });
      const sessionId = uuidv4();
      const maxAge = 100000;
      store.set(
        sessionId,
        {
          cookie: {
            maxAge,
          },
        },
        async (err) => {
          try {
            if (err) reject(err);
            else {
              const params = {
                TableName: TEST_OPTIONS.table.name,
                Key: {
                  [TEST_OPTIONS.table.hashKey]: `${TEST_OPTIONS.table.hashPrefix}${sessionId}`,
                },
              };
              const sessionRow = await documentClient.get(params).promise();
              expect(sessionRow).toBeDefined();
              expect(sessionRow.Item).toBeDefined();
              expect(sessionRow.Item.expires).toBeDefined();
              expect(Number.isInteger(sessionRow.Item.expires)).toBeTruthy();
              // make sure it's in the seconds epoch
              expect(String(sessionRow.Item.expires).length).toBe(
                String(toSecondsEpoch(new Date())).length,
              );
              // future date
              expect(sessionRow.Item.expires).toBeGreaterThan(toSecondsEpoch(new Date()));
              // should be before the default maxAge limit
              expect(sessionRow.Item.expires).toBeLessThanOrEqual(
                toSecondsEpoch(new Date(Date.now() + maxAge)),
              );
              // after 10 seconds before the limit (assuming test execution time < 5 seconds)
              expect(sessionRow.Item.expires).toBeGreaterThan(
                // eslint-disable-next-line
                toSecondsEpoch(new Date(Date.now() + maxAge - 10000)),
              );
              expect(sessionRow.Item.sess).toBeDefined();
              expect(sessionRow.Item.sess.cookie).toBeDefined();
              expect(sessionRow.Item.sess.cookie.maxAge).toBe(maxAge);
              resolve();
            }
          } catch (error) {
            reject(error);
          }
        },
      );
    }));

  it('should handle errors creating sessions', () =>
    new Promise((resolve, reject) => {
      const store = new Neo4jSessionStore(TEST_OPTIONS, (err) => {
        if (err) reject(err);
      });
      const sessionId = uuidv4();
      store.set(sessionId, null, async (err) => {
        try {
          expect(err).toBeDefined();
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    }));

  it('should update a session', () =>
    new Promise((resolve, reject) => {
      const store = new Neo4jSessionStore(TEST_OPTIONS, (err) => {
        if (err) reject(err);
      });
      const sessionId = 'abcde';
      const name = uuidv4();
      store.set(sessionId, { name: uuidv4() }, async (err) => {
        if (err) reject(err);
        store.set(sessionId, { name }, async (err2) => {
          try {
            if (err2) reject(err2);
            else {
              const params = {
                TableName: TEST_OPTIONS.table.name,
                Key: {
                  [TEST_OPTIONS.table.hashKey]: `${TEST_OPTIONS.table.hashPrefix}${sessionId}`,
                },
              };
              const sessionRow = await documentClient.get(params).promise();
              expect(sessionRow.Item.sess.name).toBe(name);
              resolve();
            }
          } catch (error) {
            reject(error);
          }
        });
      });
    }));

  it('should get an existing session', () =>
    new Promise((resolve, reject) => {
      const store = new Neo4jSessionStore(TEST_OPTIONS, (err) => {
        if (err) reject(err);
      });
      const sessionId = uuidv4();
      const name = uuidv4();
      store.set(sessionId, { name }, async (err) => {
        if (err) reject(err);
        else {
          store.get(sessionId, (err2, sess) => {
            try {
              if (err2) reject(err2);
              else {
                expect(sess).toBeDefined();
                expect(sess.name).toBe(name);
                resolve();
              }
            } catch (error) {
              reject(error);
            }
          });
        }
      });
    }));

  it('should handle errors getting sessions', () =>
    new Promise((resolve, reject) => {
      const store = new Neo4jSessionStore(TEST_OPTIONS, (err) => {
        if (err) reject(err);
      });
      store.documentClient = null;
      store.get(null, (err) => {
        try {
          expect(err).toBeDefined();
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    }));

  it('should receive null for missing sessions', () =>
    new Promise((resolve, reject) => {
      const store = new Neo4jSessionStore(TEST_OPTIONS, (err) => {
        if (err) reject(err);
      });
      store.get(uuidv4(), (err, sess) => {
        try {
          if (err) reject(err);
          else {
            expect(sess).toBe(null);
            resolve();
          }
        } catch (error) {
          reject(error);
        }
      });
    }));

  it('should return null for expired sessions and keep the record', () =>
    new Promise((resolve, reject) => {
      const store = new Neo4jSessionStore(
        {
          ...TEST_OPTIONS,
          keepExpired: true,
        },
        (err) => {
          if (err) reject(err);
        },
      );
      const sessionId = uuidv4();
      store.set(
        sessionId,
        {
          cookie: {
            maxAge: -1,
          },
        },
        async (err) => {
          if (err) reject(err);
          else {
            store.get(sessionId, async (err2, sess) => {
              try {
                if (err2) reject(err2);
                else {
                  expect(sess).toBe(null);
                  const params = {
                    TableName: TEST_OPTIONS.table.name,
                    Key: {
                      [TEST_OPTIONS.table.hashKey]: `${TEST_OPTIONS.table.hashPrefix}${sessionId}`,
                    },
                  };
                  const sessionRow = await documentClient.get(params).promise();
                  expect(sessionRow).toBeDefined();
                  expect(sessionRow.Item).toBeDefined();
                  resolve();
                }
              } catch (error) {
                reject(error);
              }
            });
          }
        },
      );
    }));

  it('should return null for expired sessions and destroy the record', () =>
    new Promise((resolve, reject) => {
      const store = new Neo4jSessionStore(TEST_OPTIONS, (err) => {
        if (err) reject(err);
      });
      const sessionId = uuidv4();
      store.set(
        sessionId,
        {
          cookie: {
            maxAge: -1,
          },
        },
        async (err) => {
          if (err) reject(err);
          else {
            store.get(sessionId, async (err2, sess) => {
              try {
                if (err2) reject(err2);
                else {
                  expect(sess).toBe(null);
                  const params = {
                    TableName: TEST_OPTIONS.table.name,
                    Key: {
                      [TEST_OPTIONS.table.hashKey]: `${TEST_OPTIONS.table.hashPrefix}${sessionId}`,
                    },
                  };
                  const sessionRow = await documentClient.get(params).promise();
                  expect(sessionRow).toBeDefined();
                  expect(sessionRow.Item).toBeUndefined();
                  resolve();
                }
              } catch (error) {
                reject(error);
              }
            });
          }
        },
      );
    }));

  it('should destroy a session', () =>
    new Promise((resolve, reject) => {
      const store = new Neo4jSessionStore(TEST_OPTIONS, (err) => {
        if (err) reject(err);
      });
      const sessionId = uuidv4();
      const name = uuidv4();
      store.set(sessionId, { name }, async (err) => {
        if (err) reject(err);
        else {
          store.destroy(sessionId, (err2) => {
            if (err2) reject(err2);
            else {
              store.get(sessionId, (err3, sess) => {
                try {
                  if (err3) reject(err3);
                  else {
                    expect(sess).toBe(null);
                    resolve();
                  }
                } catch (error) {
                  reject(error);
                }
              });
            }
          });
        }
      });
    }));

  it('should handle errors destroying sessions', () =>
    new Promise((resolve, reject) => {
      const store = new Neo4jSessionStore(TEST_OPTIONS, (err) => {
        if (err) reject(err);
      });
      store.documentClient = null;
      store.destroy(null, (err) => {
        try {
          expect(err).toBeDefined();
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    }));

  it('should touch an existing session', () =>
    new Promise((resolve, reject) => {
      const store = new Neo4jSessionStore(TEST_OPTIONS, (err) => {
        if (err) reject(err);
      });
      const sessionId = uuidv4();
      let originalExpires;
      store.set(sessionId, {}, async (err) => {
        if (err) reject(err);
        else {
          try {
            let params = {
              TableName: TEST_OPTIONS.table.name,
              Key: {
                [TEST_OPTIONS.table.hashKey]: `${TEST_OPTIONS.table.hashPrefix}${sessionId}`,
              },
            };
            let sessionRow = await documentClient.get(params).promise();
            originalExpires = sessionRow.Item.expires;
            setTimeout(() => {
              store.touch(sessionId, sessionRow.Item.sess, async (err3) => {
                if (err3) reject(err3);
                else {
                  try {
                    params = {
                      TableName: TEST_OPTIONS.table.name,
                      Key: {
                        [TEST_OPTIONS.table.hashKey]: `${
                          TEST_OPTIONS.table.hashPrefix
                        }${sessionId}`,
                      },
                    };
                    sessionRow = await documentClient.get(params).promise();
                    expect(sessionRow.Item.expires).toBeGreaterThan(originalExpires);
                    // 5 seconds window for test execution
                    expect(sessionRow.Item.expires).toBeLessThan(originalExpires + 5);
                    resolve();
                  } catch (err4) {
                    reject(err4);
                  }
                }
              });
            }, 2000);
          } catch (err2) {
            reject(err2);
          }
        }
      });
    }));

  it('should not touch an existing session before the interval', () =>
    new Promise((resolve, reject) => {
      const options = {
        ...TEST_OPTIONS,
        touchInterval: 30000,
      };
      const store = new Neo4jSessionStore(options, (err) => {
        if (err) reject(err);
      });
      const sessionId = uuidv4();
      let originalExpires;
      store.set(sessionId, {}, async (err) => {
        if (err) reject(err);
        else {
          try {
            let params = {
              TableName: TEST_OPTIONS.table.name,
              Key: {
                [TEST_OPTIONS.table.hashKey]: `${TEST_OPTIONS.table.hashPrefix}${sessionId}`,
              },
            };
            let sessionRow = await documentClient.get(params).promise();
            originalExpires = sessionRow.Item.expires;
            setTimeout(() => {
              store.touch(sessionId, sessionRow.Item.sess, async (err3) => {
                if (err3) reject(err3);
                else {
                  try {
                    params = {
                      TableName: TEST_OPTIONS.table.name,
                      Key: {
                        [TEST_OPTIONS.table.hashKey]: `${
                          TEST_OPTIONS.table.hashPrefix
                        }${sessionId}`,
                      },
                    };
                    sessionRow = await documentClient.get(params).promise();
                    expect(sessionRow.Item.expires).toBe(originalExpires);
                    resolve();
                  } catch (err4) {
                    reject(err4);
                  }
                }
              });
            }, 2000);
          } catch (err2) {
            reject(err2);
          }
        }
      });
    }));

  it('should handle errors touching sessions', () =>
    new Promise((resolve, reject) => {
      const store = new Neo4jSessionStore(TEST_OPTIONS, (err) => {
        if (err) reject(err);
      });
      store.touch(null, null, (err) => {
        try {
          expect(err).toBeDefined();
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    }));

  it('should handle errors creating the session table', () =>
    new Promise((resolve, reject) => {
      // eslint-disable-next-line
      new Neo4jSessionStore(
        {
          ...TEST_OPTIONS,
          table: {
            name: 1,
          },
        },
        (err) => {
          try {
            expect(err).toBeDefined();
            resolve();
          } catch (error) {
            reject(error);
          }
        },
      );
    }));
});
*/
