<template>
  <div>
    <div v-if="!isTypeChosen" class="host-home card">
      <img :src="headerImgLink" class="card-img-top" alt="Header image" />
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
        <a href="https://www.ably.io" target="_blank"
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
      >
      </CreateQuizRoom>
    </template>
  </div>
</template>

<script>
import CreateQuizRoom from './CreateQuizRoom.vue';

export default {
  props: ['realtime', 'ablyClientId'],
  data() {
    return {
      isTypeChosen: false,
      headerImgLink:
        'https://user-images.githubusercontent.com/5900152/93231769-037b5180-f771-11ea-817a-0b4cd2ca7dc7.png',
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
  width: 60%;
}

button {
  margin: 5px;
  width: 60%;
  font-size: 20px;
}
</style>
