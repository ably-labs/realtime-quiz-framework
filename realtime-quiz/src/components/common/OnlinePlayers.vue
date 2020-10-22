<template>
  <div>
    <div v-if="didHostStartGame">
      <h1>Your quiz starts in</h1>
      <h1 class="display-3">{{ timer }}</h1>
    </div>
    You'll see other players as they join
    <div class="online-players">
      <div
        v-for="player in onlinePlayersArr"
        :key="player.clientId"
        :style="{ color: player.avatarColor }"
        class="player-avatar"
      >
        <figure class="figure">
          <i class="fas fa-user-circle fa-3x"></i>
          <figcaption class="figure-caption">
            {{ player.nickname }}
          </figcaption>
        </figure>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: ['timer', 'onlinePlayersArr', 'didHostStartGame']
};
</script>

<style scoped>
.online-players {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: row;
  flex-wrap: wrap;
  align-content: center;
  margin: 20px auto;
  max-width: 80%;
}

.player-avatar {
  width: 70px;
  height: 70px;
  max-width: 70px;
  max-height: 70px;
}

@media only screen and (max-device-width: 480px) {
  .online-players {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: row;
    flex-wrap: wrap;
    align-content: center;
    margin: 20px auto;
    max-width: 80%;
  }
}
</style>
