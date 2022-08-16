<template>
  <div>
    <div v-if="!isTypeChosen" class="host-home card">
      <div class="img-header">
        <a href="https://www.ably.com/" class="ably-branding" target="_blank">
          <h2>Live Quiz App</h2>
          <hr />
          <div class="ably-power">
            <strong>powered by</strong>
            <img :src="headerLogo" alt="Header image" />
          </div>
        </a>
      </div>
      <div class="card-body home-text">
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
        <template v-if="!isSmallWidth">
          <button
            class="btn"
            id="btn-1"
            type="submit"
            @click="setQuizType('CustomQuiz')"
          >
            Create your own quiz
          </button>
          <button class="btn" type="submit" @click="setQuizType('RandomQuiz')">
            Host a randomly chosen quiz
          </button>
        </template>
        <template v-if="isSmallWidth">
          <small class="mobile-msg">
            It looks like you are on a mobile browser, please switch to a
            desktop to host this quiz.<br />
            Your audience can participate on mobile browsers though.
          </small>
        </template>
      </div>
      <div class="card-footer text-muted footer-black">
        <a
          href="https://github.com/Srushtika/realtime-quiz-framework"
          target="_blank"
          class="link"
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
      headerLogo:
        'https://static.ably.dev/logo-h-white.svg?realtime-quiz-framework',
      quizType: '',
      windowWidth: window.innerWidth
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
  },
  computed: {
    isSmallWidth() {
      if (this.windowWidth > 480) {
        console.log(this.windowWidth);
        return false;
      }
      console.log(this.windowWidth);
      return true;
    }
  }
};
</script>

<style scoped>
.host-home {
  margin: 0px auto;
  text-align: center;
  width: 90%;
  max-width: 900px;
}

button {
  margin: 5px;
  width: 60%;
  font-size: 20px;
  background: rgb(255, 84, 22);
  background: linear-gradient(
    90deg,
    rgba(255, 84, 22, 1) 75%,
    rgba(228, 0, 0, 1) 100%
  );
  border: 1px solid #ffffff;
  color: #ffffff;
}

button:hover {
  background: #ffffff;
  color: #e40000;
  border: 1px solid #e40000;
}

.img-header {
  width: 100%;
  background-color: #03020d;
  border-bottom: 1px gray solid;
}
.card-img-top {
  width: 80%;
}

.footer-black {
  background-color: #03020d;
  color: #ffffff;
}

.link {
  color: #ffffff;
}

.mobile-msg {
  color: red;
}

@media only screen and (max-device-width: 480px) {
  .host-home {
    margin: 0px auto;
    text-align: center;
    width: 90%;
  }
  .home-text {
    font-size: 0.8rem;
  }
  button {
    width: 90%;
    font-size: 1rem;
  }
}
</style>
