#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '../dist');

const jsContent = fs.readFileSync(path.join(distDir, 'index.js'), 'utf-8');

const cjsContent = `"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
${jsContent.replace(/export /g, 'exports.')}
module.exports = require('./index.mjs');
`;

fs.renameSync(path.join(distDir, 'index.js'), path.join(distDir, 'index.mjs'));
fs.writeFileSync(path.join(distDir, 'index.cjs'), cjsContent);

console.log('✓ Built ESM and CJS versions');
