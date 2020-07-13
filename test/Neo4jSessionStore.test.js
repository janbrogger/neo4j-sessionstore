import uuidv4 from "uuid/v4";
import Neo4jSessionStore from "../lib/Neo4jSessionStore";
import { toSecondsEpoch } from "../lib/util";
import { DEFAULT_TABLE_NAME, DEFAULT_TTL } from "../lib/constants";
import { execSync } from "child_process";
const neo4j = require("neo4j-driver");

const TEST_OPTIONS = {
  table: {
    name: "testSessions",
    hashKey: "testSessionId",
    hashPrefix: "test:",
  },
  neo4jConfig: {
    neo4jurl: "bolt://localhost:7687",
    neo4juser: "neo4j",
    neo4jpwd: "test",
  },
  touchInterval: 0,
};

function getNeo4jsession() {
  const neo4jurl = TEST_OPTIONS.neo4jConfig.neo4jurl;
  const neo4juser = TEST_OPTIONS.neo4jConfig.neo4juser;
  const neo4jpwd = TEST_OPTIONS.neo4jConfig.neo4jpwd;
  const neo4jauth = neo4j.auth.basic(neo4juser, neo4jpwd);
  const neo4jdriver = neo4j.driver(neo4jurl, neo4jauth);
  const neo4jsession = neo4jdriver.session();
  return {
    neo4jdriver: neo4jdriver,
    neo4jsession: neo4jsession,
  };
}

function closeNeo4j(neo4jdriver, neo4jsession) {
  if (neo4jsession) neo4jsession.close();
  if (neo4jdriver) neo4jdriver.close();
}

async function deleteEverythingInDatabase() {
  const { neo4jdriver, neo4jsession } = getNeo4jsession();
  const queryString = "MATCH (n) DELETE (n);";
  await neo4jsession.run(queryString).then((result) => {
    closeNeo4j(neo4jdriver, neo4jsession);
  });
}

async function getNodeCount() {
  const { neo4jdriver, neo4jsession } = getNeo4jsession();
  const queryString = "MATCH (n) RETURN count(n) as nodecount;";

  const nodeCount = await neo4jsession.run(queryString).then((result) => {
    return Math.max.apply(
      Math,
      result.records.map((record) => {
        return record.get("nodecount").toNumber();
      })
    );
  });
  closeNeo4j(neo4jdriver, neo4jsession);
  return nodeCount;
}

/**
 * Setups a test environment on Docker.
 */
beforeAll(async () => {
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

  await deleteEverythingInDatabase();
});

beforeEach(async () => {
  await deleteEverythingInDatabase();
});

afterEach(async () => {
  await deleteEverythingInDatabase();
});

/**
 * Resets the database by deleting ALL entries.
 */
afterAll(async () => {
  await deleteEverythingInDatabase();
});

describe("Neo4jSessionStore", () => {
  it("X1 Database connectivity test", (done) => {
    expect.assertions(1);
    getNodeCount().then((result) => {
      expect(result).toBe(0);
      done();
    });
  });

  it("X2 should create a store and a new table", () => {
    return new Promise(async (resolve, reject) => {
      expect.assertions(3);
      const options = {
        table: {
          name: "testsessionsnew",
          hashKey: "testsessionId",
          hashPrefix: "test:",
        },
        neo4jConfig: TEST_OPTIONS.neo4jConfig,
      };

      const nodeCount = await getNodeCount();
      expect(nodeCount).toBe(0);
      const store = await new Neo4jSessionStore(options, async (err) => {
        expect(err).toBeUndefined();
        store.close();
        const nodeCount2 = await getNodeCount();
        expect(nodeCount2).toBe(1);
        resolve();
      });
    });
  });

  it("X3 should create a store using an existing table", async () => {
    // Start with empty database
    const nodeCount = await getNodeCount();
    expect(nodeCount).toBe(0);

    // Create existing table for test
    const { neo4jdriver, neo4jsession } = getNeo4jsession();
    const queryString = `CREATE (n:${TEST_OPTIONS.table.name});`;
    await neo4jsession.run(queryString);
    closeNeo4j(neo4jdriver, neo4jsession);
    const nodeCount2 = await getNodeCount();
    expect(nodeCount2).toBe(1);

    const store = new Neo4jSessionStore(TEST_OPTIONS);
    expect(store).toBeDefined();
    const nodeCount3 = await getNodeCount();
    expect(nodeCount3).toBe(1);
    store.close();
  });

  it("X4 should create a store with default table values", () =>
    new Promise((resolve, reject) => {
      expect.assertions(2);
      const options = { neo4jConfig: TEST_OPTIONS.neo4jConfig };

      const store = new Neo4jSessionStore(options, (err) => {
        try {
          expect(store).toBeDefined();
          expect(err).toBeUndefined();
          store.close();
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    }));

  it("X5 should set a session", () => {
    return new Promise((resolve, reject) => {
      expect.assertions(5);
      const options = { neo4jConfig: TEST_OPTIONS.neo4jConfig };

      const store = new Neo4jSessionStore(options);
      const sessionId = uuidv4();
      const name = uuidv4();
      const sessionIdWithPrefix = store.getSessionId(sessionId);
      store.set(sessionId, { name }, async (err) => {
        if (err) reject(err);
        const nodeCount = await getNodeCount();
        expect(nodeCount).toBe(2);
        store.close();

        const { neo4jdriver, neo4jsession } = getNeo4jsession();
        const queryString = `MATCH (n:sessions) WHERE n.sessionId="${sessionIdWithPrefix}" RETURN (n);`;

        neo4jsession
          .run(queryString)
          .then((result) => {
            const records = result.records.map((r) => r.get("n"));
            expect(records.length).toEqual(1);
            var record = records[0];
            // throw new Error(record);
            expect(record.properties["sessionId"]).toEqual(sessionIdWithPrefix);
            expect(record.properties["expires"]).toBeDefined();
            expect(record.properties["sess"]).toBeDefined();
            closeNeo4j(neo4jdriver, neo4jsession);
            resolve();
          })
          .catch((err) => {
            closeNeo4j(neo4jdriver, neo4jsession);
            reject(err);
          });
      });
    });
  });

  it("X6 should get a session", async () => {
    return new Promise((resolve, reject) => {
      expect.assertions(4);
      const options = { neo4jConfig: TEST_OPTIONS.neo4jConfig };

      const store = new Neo4jSessionStore(options);
      const sessionId = uuidv4();
      const name = uuidv4();
      const sessionIdWithPrefix = store.getSessionId(sessionId);
      store.set(sessionId, { name }, (err) => {
        if (err) reject(err);
        store.get(sessionId, (err, sess) => {
          store.close();
          expect(err).toBeNull();
          expect(sess).toBeDefined();
          expect(sess.name).toBeDefined();
          expect(sess.updated).toBeDefined();
          resolve();
        });
      });
    });
  });

  it("X7 should create session with default ttl", async () => {
    return new Promise((resolve, reject) => {
      expect.assertions(9);
      const options = { neo4jConfig: TEST_OPTIONS.neo4jConfig };

      const store = new Neo4jSessionStore(options);
      const sessionId = uuidv4();
      const name = uuidv4();
      const sessionIdWithPrefix = store.getSessionId(sessionId);
      store.set(sessionId, { name }, (err) => {
        if (err) reject(err);
        store.get(sessionId, (err, sess) => {
          store.close();
          const { neo4jdriver, neo4jsession } = getNeo4jsession();
          const queryString = `MATCH (n:sessions) WHERE n.sessionId="${sessionIdWithPrefix}" RETURN (n);`;

          neo4jsession
            .run(queryString)
            .then((result) => {
              const records = result.records.map((r) => r.get("n"));
              expect(records.length).toEqual(1);
              var record = records[0];

              expect(record.properties["sessionId"]).toEqual(
                sessionIdWithPrefix
              );
              expect(record.properties["expires"]).toBeDefined();
              expect(record.properties["sess"]).toBeDefined();

              // future date
              expect(record.properties["expires"]).toBeGreaterThan(
                toSecondsEpoch(new Date())
              );
              // should be before the default ttl limit
              expect(record.properties["expires"]).toBeLessThanOrEqual(
                toSecondsEpoch(new Date(Date.now() + DEFAULT_TTL))
              );
              // after 10 seconds before the limit (assuming test execution time < 5 seconds)
              expect(record.properties["expires"]).toBeGreaterThan(
                // eslint-disable-next-line
                toSecondsEpoch(new Date(Date.now() + DEFAULT_TTL - 10000))
              );
              expect(record.properties["sess"]).toBeDefined();
              expect(JSON.parse(record.properties["sess"]).name).toBe(name);

              closeNeo4j(neo4jdriver, neo4jsession);
              resolve();
            })
            .catch((err) => {
              closeNeo4j(neo4jdriver, neo4jsession);
              reject(err);
            });
        });
      });
    });
  });

  it("X8 should create session using the cookie maxAge", async () => {
    return new Promise((resolve, reject) => {
      expect.assertions(9);
      const options = { neo4jConfig: TEST_OPTIONS.neo4jConfig };

      const store = new Neo4jSessionStore(options);
      const sessionId = uuidv4();
      const name = uuidv4();
      const maxAge = 100000;
      const sessionIdWithPrefix = store.getSessionId(sessionId);
      store.set(
        sessionId,
        {
          name,
          cookie: {
            maxAge,
          },
        },
        async (err) => {
          if (err) reject(err);
          store.get(sessionId, (err, sess) => {
            store.close();
            const { neo4jdriver, neo4jsession } = getNeo4jsession();
            const queryString = `MATCH (n:sessions) WHERE n.sessionId="${sessionIdWithPrefix}" RETURN (n);`;

            neo4jsession
              .run(queryString)
              .then((result) => {
                const records = result.records.map((r) => r.get("n"));
                expect(records.length).toEqual(1);
                var record = records[0];

                expect(record.properties["sessionId"]).toEqual(
                  sessionIdWithPrefix
                );
                expect(record.properties["expires"]).toBeDefined();
                expect(record.properties["sess"]).toBeDefined();

                // future date
                expect(record.properties["expires"]).toBeGreaterThan(
                  toSecondsEpoch(new Date())
                );
                // should be before the default maxAge limit
                expect(record.properties["expires"]).toBeLessThanOrEqual(
                  toSecondsEpoch(new Date(Date.now())) + maxAge
                );
                // after 10 seconds before the limit (assuming test execution time < 5 seconds)
                expect(record.properties["expires"]).toBeGreaterThan(
                  // eslint-disable-next-line
                  toSecondsEpoch(new Date(Date.now() + maxAge - 10000))
                );

                expect(record.properties["sess"]).toBeDefined();
                expect(JSON.parse(record.properties["sess"]).name).toBe(name);

                closeNeo4j(neo4jdriver, neo4jsession);
                resolve();
              })
              .catch((err) => {
                closeNeo4j(neo4jdriver, neo4jsession);
                reject(err);
              });
          });
        }
      );
    });
  });

  it("X9 should handle errors creating sessions", () =>
    new Promise((resolve, reject) => {
      const store = new Neo4jSessionStore(TEST_OPTIONS, (err) => {
        if (err) reject(err);
      });
      const sessionId = uuidv4();
      store.set(sessionId, null, async (err) => {
        try {
          store.close();
          expect(err).toBeDefined();
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    }));
});
/*
  
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

  it('should handle errors creating the session table', () =>
    new Promise((resolve, reject) => {
      // eslint-disable-next-line
      new Neo4jSessionStore(
        {Promises fixed
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
