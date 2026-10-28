import { networkDiagnostics } from '../src/diagnostics.js';
console.log(JSON.stringify(await networkDiagnostics()(), null, 2));
