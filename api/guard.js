// Vercel serverless entrypoint for Synapse Guard (/api/auth/*, /api/guard/*, /api/admin/*).
const express = require('express');
const { guardRouter, seedDemoUsers } = require('../guard/src/index');

seedDemoUsers();
const app = express();
app.use(express.json());
app.use('/api', guardRouter);

module.exports = app;
