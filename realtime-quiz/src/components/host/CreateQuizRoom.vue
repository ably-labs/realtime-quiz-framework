<template>
  <div>
    <div v-if="!showQuestions" class="host-home card">
      <div v-if="!isRoomReady" class="card-body">
        <h2 class="card-title">
          Host
          {{ quizType === 'CustomQuiz' ? 'your own ' : 'a randomly chosen ' }}
          quiz
        </h2>
        <template v-if="quizType == 'CustomQuiz'"
          ><div>
            <p class="card-text">
              You can add your own quiz questions in Google Sheets and host a
              live quiz. Simply make a copy of the template and fill it with
              your data.
            </p>
            <div class="sheets-template">
              <a
                class="orange-txt"
                :href="templateCopyURL"
                target="_blank"
                role="button"
              >
                Get the Google Sheets template</a
              >
              <p class="card-text template-instructions">
                After you've prepared the questions and answers, you need to do
                two things: <br />
                1. Copy the URL of your sheet from the browser's address bar and
                paste it in the field below
                <input
                  class="form-control input-box"
                  placeholder="Add the URL to your sheet"
                  v-model="sheetURL"
                  :disabled="createBtnClicked"
                />
                2. Make your Google sheet publicly available by going to File >
                Publish to the web > Publish. You might be presented with a
                different shareable URL, you can ignore that.
              </p>
            </div>
          </div>
        </template>

        <p class="card-text">
          We need a nickname for you so the players of your quiz can identify
          you
        </p>
        <input
          class="form-control input-box"
          placeholder="Enter nickname"
          v-model="hostNickname"
          :disabled="createBtnClicked"
          @keyup.enter="createQuizRoom()"
        />

        <button
          type="button create-random-btn"
          class="btn"
          @click="createQuizRoom()"
          :disabled="createBtnClicked"
        >
          {{ btnText }}
        </button>
        <div
          class="alert alert-danger sheet-error"
          role="alert"
          v-if="sheetURLErr"
        >
          There is a problem with the URL to your sheet. Please recheck it per
          the instructions above, refresh this page and try again. You can reach
          out to support@ably.com for further assistance.
        </div>
      </div>
      <div v-else class="card-body">
        <h2 class="card-title">Your quiz room is ready</h2>
        <p class="card-text">
          Invite your players to join by sharing this link
        </p>
        <button type="button" class="btn" @click="copyPlayerInviteLink()">
          {{ copyBtnText }}
          <i v-if="!copyClicked" class="far fa-copy"></i>
        </button>
        <hr />
        <OnlinePlayers
          :timer="timer"
          :onlinePlayersArr="onlinePlayersArr"
          :didHostStartGame="didHostStartGame"
        ></OnlinePlayers>
        <template v-if="onlinePlayersArr.length > 0">
          <div v-if="!didHostStartGame">
            <hr />
            <button type="button" class="btn" @click="startQuiz()">
              Start the quiz
            </button>
          </div>
        </template>
      </div>
      <div class="card-footer text-muted div-black">
        <button type="button" class="btn btn-link back-btn" @click="showHome()">
          &larr; Go back
        </button>
      </div>
    </div>
    <div v-if="showQuestions && !showFinalScreen" class="d-flex bd-highlight">
      <div class="question-flex bd-highlight">
        <Question
          :newQuestion="newQuestion"
          :newChoices="newChoices"
          :newQuestionNumber="newQuestionNumber"
          :isLastQuestion="isLastQuestion"
          :questionTimer="questionTimer"
          :correctAnswerIndex="correctAnswerIndex"
          :showImg="showImg"
          :questionImgLink="questionImgLink"
          :isAdminView="true"
          :correctAnswer="newChoices[correctAnswerIndex]"
          :showAnswer="showAnswer"
        ></Question>
      </div>
      <div class="stats-flex bd-highlight">
        <LiveStats
          :numAnswered="numAnswered"
          :numPlaying="numPlaying"
          v-if="!showAnswer"
        ></LiveStats>
        <div v-if="showAnswer">
          <Leaderboard
            :leaderboard="leaderboard"
            :isPlayer="false"
            :finalScreen="false"
          ></Leaderboard>
          <AdminPanel
            :hostAdminCh="hostAdminCh"
            :prevQuestionNumber="newQuestionNumber"
            @end-quiz-now="endQuizNow()"
          ></AdminPanel>
        </div>
      </div>
    </div>
    <div v-if="showFinalScreen" class="quizEnded">
      <div class="text-white end-msg">
        <h6>The quiz has ended</h6>
        <h1 class="display-4">Congratulations to the winners 🎉🎉🎉</h1>
      </div>
      <Leaderboard
        :leaderboard="leaderboard"
        :isPlayer="false"
        :finalScreen="true"
      ></Leaderboard>
    </div>
  </div>
</template>

<script>
import Question from '../common/Question.vue';
import OnlinePlayers from '../common/OnlinePlayers.vue';
import AdminPanel from './AdminPanel.vue';
import LiveStats from '../common/LiveStats.vue';
import Leaderboard from '../common/Leaderboard.vue';
import * as GSheetReader from 'g-sheets-api';
export default {
  name: 'QuizType',
  props: ['resetCmpFn', 'realtime', 'quizType', 'showHome'],
  components: {
    Question,
    AdminPanel,
    LiveStats,
    Leaderboard,
    OnlinePlayers
  },
  data() {
    return {
      globalQuizChName: 'main-quiz-thread',
      globalQuizCh: null,
      myQuizRoomCode: this.getRandomRoomId(),
      myQuizRoomCh: null,
      hostAdminCh: 'a',
      hostNickname: null,
      btnText: 'Create my quiz room',
      createBtnClicked: false,
      isRoomReady: false,
      playerLinkBase: window.location.href + 'play',
      playerLink: null,
      copyBtnText: 'Copy shareable link',
      copyClicked: false,
      onlinePlayersArr: [],
      didHostStartGame: false,
      timer: null,
      showQuestions: false,
      newQuestionNumber: null,
      newQuestion: null,
      newChoices: [],
      isLastQuestion: null,
      questionTimer: 30,
      correctAnswerIndex: null,
      showAnswer: false,
      numAnswered: 0,
      numPlaying: 0,
      leaderboard: null,
      templateCopyURL:
        'https://docs.google.com/spreadsheets/d/12_Cnv86fI4JOnJq5t9BQmxiPTNZgMsd0PP7Sbjm7WkQ/copy?usp=sharing',
      sheetURL: '',
      sheetURLErr: false,
      customQuizQuestions: null,
      showImg: false,
      questionImgLink: null,
      showFinalScreen: false
    };
  },
  methods: {
    createQuizRoom() {
      this.createBtnClicked = true;
      if (this.quizType === 'RandomQuiz') {
        this.btnText = 'Creating your quiz room...';
      } else {
        this.btnText = 'Loading your questions and creating your quiz room...';
        let mySheetId = new RegExp('/spreadsheets/d/([a-zA-Z0-9-_]+)').exec(
          this.sheetURL
        )[1];
        if (mySheetId == null || this.sheetURL == null) {
          this.sheetURLErr = true;
          return;
        }
        const options = {
          sheetId: mySheetId,
          sheetNumber: 1,
          returnAllResults: true
        };
        GSheetReader(
          options,
          results => {
            this.customQuizQuestions = results;
          },
          error => {
            this.sheetURLErr = true;
            console.log(error);
            return;
          }
        );
      }
      this.waitForGameRoom();
      this.enterMainThread();
    },
    waitForGameRoom() {
      this.myQuizRoomCh = this.realtime.channels.get(
        `${this.myQuizRoomCode}:primary`
      );
      this.hostAdminCh = this.realtime.channels.get(
        `${this.myQuizRoomCode}:host`
      );
      this.myQuizRoomCh.subscribe('thread-ready', () => {
        this.handleQuizRoomReady();
      });
    },
    handleQuizRoomReady() {
      this.isRoomReady = true;
      this.globalQuizCh.detach();
      this.enterGameRoomAndSubscribeToEvents();
      this.playerLink = `${this.playerLinkBase}?quizCode=${this.myQuizRoomCode}`;
      if (this.quizType == 'CustomQuiz') {
        let questions = this.customQuizQuestions;
        this.hostAdminCh.publish('quiz-questions', {
          questions
        });
      }
    },
    enterGameRoomAndSubscribeToEvents() {
      this.myQuizRoomCh.presence.enter({
        nickname: this.hostNickname,
        avatarColor: this.myAvatarColor,
        isHost: true,
        quizType: this.quizType
      });
      this.subscribeToRoomChEvents();
    },
    enterMainThread() {
      this.globalQuizCh = this.realtime.channels.get(this.globalQuizChName);
      this.globalQuizCh.presence.enter({
        nickname: this.hostNickname,
        roomCode: this.myQuizRoomCode
      });
    },
    getRandomRoomId() {
      return (
        'room-' +
        Math.random()
          .toString(36)
          .substr(2, 8)
      );
    },
    subscribeToRoomChEvents() {
      this.myQuizRoomCh.subscribe('new-player', msg => {
        this.handleNewPlayerEntered(msg);
      });
      this.myQuizRoomCh.subscribe('start-quiz-timer', msg => {
        this.didHostStartGame = true;
        this.timer = msg.data.countDownSec;
      });
      this.myQuizRoomCh.subscribe('new-question', msg => {
        this.handleNewQuestionReceived(msg);
      });
      this.myQuizRoomCh.subscribe('question-timer', msg => {
        this.questionTimer = msg.data.countDownSec;
        if (this.questionTimer < 0) {
          this.questionTimer = 30;
        }
      });
      this.myQuizRoomCh.subscribe('correct-answer', msg => {
        this.handleCorrectAnswerReceived(msg);
      });
      this.myQuizRoomCh.subscribe('live-stats-update', msg => {
        this.numAnswered = msg.data.numAnswered;
        this.numPlaying = msg.data.numPlaying;
      });
      this.myQuizRoomCh.subscribe('full-leaderboard', msg => {
        this.leaderboard = msg.data.leaderboard;
      });
    },
    handleNewPlayerEntered(msg) {
      let { clientId, nickname, avatarColor, isHost } = msg.data.newPlayerState;
      if (!isHost) {
        this.onlinePlayersArr.push({
          clientId,
          nickname,
          avatarColor,
          isHost
        });
      } else {
        return;
      }
    },
    handleNewQuestionReceived(msg) {
      this.showAnswer = false;
      this.showQuestions = true;
      this.newQuestionNumber = msg.data.questionNumber;
      this.newQuestion = msg.data.question;
      this.newChoices = msg.data.choices;
      this.isLastQuestion = msg.data.isLastQuestion;
      this.numAnswered = msg.data.numAnswered;
      this.numPlaying = msg.data.numPlaying;
      this.showImg = msg.data.showImg;
      this.questionImgLink = msg.data.imgLink;
    },
    handleCorrectAnswerReceived(msg) {
      this.showAnswer = true;
      if (this.newQuestionNumber == msg.data.questionNumber) {
        this.correctAnswerIndex = msg.data.correctAnswerIndex;
      }
      if (this.isLastQuestion) {
        this.showFinalScreen = true;
      }
    },
    copyPlayerInviteLink() {
      this.copyClicked = true;
      this.copyBtnText = 'Copied!';
      setTimeout(() => {
        this.copyClicked = false;
        this.copyBtnText = 'Copy shareable link';
      }, 2000);
      navigator.clipboard.writeText(this.playerLink);
    },
    startQuiz() {
      this.hostAdminCh.publish('start-quiz', {
        start: true
      });
    },
    endQuizNow() {
      this.showFinalScreen = true;
    }
  },
  beforeDestroy() {
    if (this.myQuizRoomCh) {
      this.myQuizRoomCh.presence.leave();
    }
    this.questionTimer = 30;
  }
};
</script>

<style scoped>
.host-home {
  margin: 0px auto;
  text-align: center;
  width: 60%;
}
.input-box {
  width: 40%;
  margin: 20px auto;
  text-align: center;
}
.sheets-template {
  text-align: center;
  background-color: #f1f5f6;
  margin: 15px auto;
  padding: 25px;
  width: 100%;
}
.template-instructions {
  margin: 20px auto;
}
.sheet-error {
  margin: 20px;
}
.question-flex {
  width: 65%;
}
.stats-flex {
  width: 50%;
}
.quizEnded {
  width: 80%;
  margin: 20px auto;
  font-size: 20px;
}
.end-msg {
  text-align: center;
  margin: 10px auto;
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
.back-btn {
  background: none;
  border: none;
  color: #ffffff;
  padding: 0px;
  margin: 0px;
}

.div-black {
  background-color: #03020d;
  color: #ffffff;
}

.back-btn:hover {
  border: none;
  background: none;
  color: #ffffff;
}

.orange-txt {
  color: #ff5416;
}

@media only screen and (max-device-width: 480px) {
  .host-home {
    margin: 0px auto;
    text-align: center;
    width: 90%;
    font-size: 0.9rem;
  }
  .nickname-input {
    display: flex;
    justify-content: space-evenly;
    width: 70%;
    text-align: center;
    margin: 0 auto;
  }
  .alert-quiz-ended {
    width: 90%;
    margin: 20px auto;
    text-align: center;
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
