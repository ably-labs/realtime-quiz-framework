<template>
  <div class="card text-white bg-dark mb-3 livestats-div">
    <div class="card-header">Live stats</div>
    <div class="card-body">
      <h5 class="card-title">
        {{ numAnswered }} of {{ numPlaying }} people have answered this question
      </h5>
    </div>
  </div>
</template>

<script>
export default {
  name: 'LiveStats',
  props: ['numAnswered', 'numPlaying']
};
</script>

<style scoped>
.livestats-div {
  width: 90%;
  margin: 20px auto;
  text-align: center;
}
</style>
