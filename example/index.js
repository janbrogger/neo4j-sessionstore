const express = require('express');
const os = require('os');
const bodyParser = require('body-parser');
const session = require('express-session');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(bodyParser.json());

const STORE_OPTIONS = {
  table: {
    name: "sessions",
    hashKey: "sessionId",
    hashPrefix: "sessions:",
  },
  neo4jConfig: {
    neo4jurl: "bolt://localhost:7687",
    neo4juser: "neo4j",
    neo4jpwd: "test",
  },
  touchInterval: 0,
};

var Neo4jSessionStore = require('../dist/Neo4jSessionStore').default;

var sessionConfig = {
    secret: 'mysecret',
    store: new Neo4jSessionStore(STORE_OPTIONS),
    resave: false,
    saveUninitialized: false,
    genid: (req) => {
        return uuidv4(); 
    },
    cookie: {
        httpOnly: true,
        sameSite: 'strict',
    }
}

app.use(session(sessionConfig));

app.listen(process.env.PORT || 8081, () => console.log(module.filename + ` Listening on port ${process.env.PORT || 8081}!`));