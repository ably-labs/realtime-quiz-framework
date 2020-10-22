import PlayerHome from './components/player/PlayerHome.vue';
import HostHome from './components/host/HostHome.vue';

export const routes = [
  { path: '/play', component: PlayerHome },
  { path: '', component: HostHome }
];
