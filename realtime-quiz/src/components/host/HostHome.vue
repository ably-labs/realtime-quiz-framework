<template>
  <div>
    <div v-if="!isTypeChosen" class="host-home card">
      <div class="img-header">
        <img :src="headerImgLink" class="card-img-top" alt="Header image" />
      </div>
      <div class="card-body">
        <h5 class="card-title">Hello Quizmaster!</h5>
        <p class="card-text">
          You can use this app to upload your own quiz questions and host a live
          quiz for any number of participants. As the host, you'll be able to
          see the live stats at all times and will have full control of the quiz
          during the live game. You can try it out by hosting a randomly chosen
          quiz!
        </p>
        <p class="card-text">
          You can share your screen with the participants while they answer the
          questions via their mobile browsers for best experience.
        </p>
        <button
          class="btn btn-primary"
          type="submit"
          @click="setQuizType('CustomQuiz')"
        >
          Create your own quiz
        </button>
        <button
          class="btn btn-primary"
          type="submit"
          @click="setQuizType('RandomQuiz')"
        >
          Host a randomly chosen quiz
        </button>
      </div>
      <div class="card-footer text-muted">
        <a
          href="https://github.com/Srushtika/realtime-quiz-framework"
          target="_blank"
          >Learn how to build your own realtime quiz app with Ably &rarr;</a
        >
      </div>
    </div>
    <template v-if="isTypeChosen">
      <CreateQuizRoom
        :realtime="realtime"
        :ablyClientId="ablyClientId"
        :quizType="quizType"
        :showHome="showHome"
        :stopTheSnow="stopTheSnow"
      >
      </CreateQuizRoom>
    </template>
  </div>
</template>

<script>
import CreateQuizRoom from './CreateQuizRoom.vue';

export default {
  props: ['realtime', 'ablyClientId', 'stopTheSnow'],
  data() {
    return {
      isTypeChosen: false,
      headerImgLink:
        'https://user-images.githubusercontent.com/5900152/100897082-3c48de00-34b7-11eb-813a-202acf9e9ac5.png',
      quizType: ''
    };
  },
  components: {
    CreateQuizRoom
  },
  methods: {
    setQuizType(type) {
      this.isTypeChosen = true;
      this.quizType = type;
    },
    showHome() {
      this.isTypeChosen = false;
    }
  }
};
</script>

<style scoped>
.host-home {
  margin: 0px auto;
  text-align: center;
  width: 65%;
}

button {
  margin: 5px;
  width: 60%;
  font-size: 20px;
}
.img-header {
  width: 100%;
  background-color: #dde0e1;
}

.card-img-top {
  width: 80%;
}
</style>
