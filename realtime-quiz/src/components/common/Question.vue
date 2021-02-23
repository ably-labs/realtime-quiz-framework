<template>
  <div class="card" :class="viewType">
    <div class="card-header">Question {{ newQuestionNumber }}</div>
    <h2 class="question-div card-title">{{ newQuestion }}</h2>
    <div class="img-div" v-if="showImg">
      <img
        :src="questionImgLink"
        class="img-fluid q-img"
        alt="Image for the question"
      />
    </div>
    <Answer
      v-if="showAnswer"
      :correctAnswer="newChoices[correctAnswerIndex]"
      :isAdminView="true"
    ></Answer>
    <div class="card-body" v-if="!showAnswer">
      <h5 class="card-title"></h5>
      <div class="choices-container" v-if="!answerSubmitted && !isAdminView">
        <button
          type="button"
          class="btn btn-outline-dark choice-btn"
          v-for="(choice, index) in newChoices"
          :key="choice"
          @click="sendMyAnswer(choice, index)"
        >
          {{ choice }}
        </button>
      </div>
      <div class="choices-container" v-if="isAdminView">
        <div class="choice-div" v-for="choice in newChoices" :key="choice">
          {{ choice }}
        </div>
      </div>
      <div class="submitted-msg" v-if="answerSubmitted">
        <h5>
          Your answer is submitted, waiting for everyone else to answer...
        </h5>
      </div>
    </div>
    <div v-if="!(isAdminView && showAnswer)" class="progress">
      <div
        class="progress-bar progress-bar-striped progress-bar-animated bg-dark"
        role="progressbar"
        :style="{ width: (questionTimer / 30) * 100 + '%' }"
        aria-valuemin="0"
        aria-valuemax="100"
      >
        {{ questionTimer }}
      </div>
    </div>
  </div>
</template>

<script>
import Answer from '../common/Answer.vue';

export default {
  name: 'Question',
  components: {
    Answer
  },
  props: [
    'isAdminView',
    'newQuestion',
    'newChoices',
    'newQuestionNumber',
    'isLastQuestion',
    'questionTimer',
    'correctAnswerIndex',
    'myInputCh',
    'showImg',
    'questionImgLink',
    'showAnswer',
    'correctAnswer'
  ],
  data() {
    return {
      answerSubmitted: false,
      viewType:
        this.isAdminView == true
          ? 'questions-card-host'
          : 'questions-card-player'
    };
  },
  methods: {
    sendMyAnswer(choice, index) {
      if (!this.isAdminView) {
        this.answerSubmitted = true;
        this.$emit('player-answer', {
          questionIndex: this.newQuestionNumber - 1,
          playerAnswerIndex: index
        });
        this.myInputCh.publish('player-answer', {
          questionIndex: this.newQuestionNumber - 1,
          playerAnswerIndex: index,
          choice: choice
        });
      }
    }
  }
};
</script>

<style scoped>
.questions-card-player {
  width: 60%;
  margin: 20px auto;
  text-align: center;
}

.questions-card-host {
  width: 90%;
  margin: 20px auto;
  text-align: center;
}

.question-div {
  max-height: 200px;
  margin: 20px;
}

.img-div {
  margin: 0 auto;
  max-width: 50%;
}

.q-img {
  max-height: 200px;
}

.choices-container {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
}

.choice-btn {
  flex: 0 46%;
  height: 60px;
  margin: 2%;
}

.choice-div {
  flex: 0 46%;
  height: 60px;
  line-height: 60px;
  margin: 2%;
  border: thin solid gray;
}

.submitted-msg {
  text-align: center;
  margin: 0px auto;
  color: gray;
}

@media only screen and (max-device-width: 480px) {
  .questions-card-player {
    width: 90%;
    margin: 10px auto;
    text-align: center;
  }

  .question-div {
    max-height: 100px;
    margin: 20px;
    font-size: 15px;
  }

  .img-div {
    margin: 0 auto;
    max-width: 50%;
  }

  .q-img {
    max-height: 100px;
  }

  .choices-container {
    display: block;
  }

  .choice-btn {
    width: 100%;
    height: 60px;
    margin: 2%;
  }

  .choice-div {
    width: 100%;
    height: 60px;
    margin: 2%;
    border: gray;
  }
  .submitted-msg {
    text-align: center;
    margin: 0px auto;
    color: gray;
  }
}
</style>
