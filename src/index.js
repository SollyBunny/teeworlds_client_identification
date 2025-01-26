#!/bin/env node

import { createServer } from "./server.js";
import { TCI } from "./tci.js";

import { PORT } from "./config.js";

const tci = new TCI();
await createServer(PORT, tci);
console.log(`Server listening on port ${PORT}`);
