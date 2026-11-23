import '@fontsource/fraunces/400.css';
import '@fontsource/fraunces/400-italic.css';
import '@fontsource/fraunces/600.css';
import '@fontsource/fraunces/600-italic.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/600.css';
import '@fontsource/nunito/700.css';
import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';

const target = document.getElementById('app');
if (!target) throw new Error('Missing #app');

const app = mount(App, { target });

export default app;
