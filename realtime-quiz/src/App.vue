<template>
  <div id="app">
    <router-view :realtime="realtime"></router-view>
  </div>
</template>

<script>
import * as Ably from 'ably';

export default {
  name: 'App',
  components: {},
  data() {
    return {
      realtime: null
    };
  },
  created() {
    this.realtime = new Ably.Realtime({
      authUrl: '/auth'
    });
  },
  destroyed() {
    this.realtime.connection.close();
  }
};
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
  margin-top: 30px;
}
</style>
