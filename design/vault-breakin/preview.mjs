import { createDemoAdapter } from './demo-adapter.mjs';
import { mountVault } from './vault.mjs';
const root = document.querySelector('#vault-root');
const adapter = createDemoAdapter();
let view = mountVault(root, adapter);
const reset = () => { view.destroy(); adapter.reset(document.querySelector('#scenario').value); view = mountVault(root, adapter); };
document.querySelector('#reset').addEventListener('click', reset);
document.querySelector('#scenario').addEventListener('change', reset);
