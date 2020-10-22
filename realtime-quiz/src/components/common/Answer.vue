<template>
  <div class="card alert answer-div answer-card" :class="cardColorClass">
    <div class="answer-eval" v-if="!isAdminView">
      <i
        class="fas"
        :class="didAnswerCorrectly ? 'fa-check-circle' : 'fa-times-circle'"
      ></i>
      {{ evalMessage }}
    </div>
    <hr v-if="!isAdminView" />
    <h5>The answer is</h5>
    <h2 class="card-title answer-text">{{ correctAnswer }}</h2>
  </div>
</template>

<script>
export default {
  name: 'Answer',
  props: ['correctAnswer', 'isAdminView', 'didAnswerCorrectly'],
  data() {
    return {
      evalMessage:
        this.didAnswerCorrectly === true ? 'Correct Answer' : 'Wrong Answer',
      cardColorClass: null,
      viewType:
        this.isAdminView == true ? 'answer-card-host' : 'answer-card-player'
    };
  },
  methods: {},
  created() {
    if (this.isAdminView) {
      this.cardColorClass = 'alert-secondary';
    } else {
      this.cardColorClass = this.didAnswerCorrectly
        ? 'alert-success'
        : 'alert-danger';
    }
  }
};
</script>

<style scoped>
.answer-card {
  width: 60%;
  margin: 20px auto;
  text-align: center;
}

.answer-eval {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
}
.answer-div {
  max-height: 200px;
  padding: 10px;
}

.answer-text {
  margin: 20px;
}

@media only screen and (max-device-width: 480px) {
  .answer-card {
    width: 90%;
    margin: 20px auto;
    text-align: center;
  }
}
</style>
