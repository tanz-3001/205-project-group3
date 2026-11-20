// Standalone server so you can run and demo Guard on its own.
const express = require('express');
const { guardRouter, seedDemoUsers } = require('./index');

seedDemoUsers();
const app = express();
app.use(express.json());
app.use('/api', guardRouter);
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Synapse Guard running on http://localhost:${PORT}`));
