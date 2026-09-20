import React from 'react';
import ReactDOM from 'react-dom/client';
import RegimentWars from '../views/RegimentWars';
// This entry has no auth or economy imports, so a local playtest cannot reach live accounts.
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><RegimentWars standalone /></React.StrictMode>);
