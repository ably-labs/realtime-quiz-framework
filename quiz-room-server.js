const randomQuestions = require('./quiz-questions.json');
const { parentPort, workerData } = require('worker_threads');
const Ably = require('ably/promises');
const START_TIMER_SEC = 5;
const QUESTION_TIMER_SEC = 30;

const ABLY_API_KEY = process.env.ABLY_API_KEY;
const globalPlayersState = {};
const playerChannels = {};
let didQuizStart = false;
let totalPlayers = 0;
const quizRoomChName = `${workerData.hostRoomCode}:primary`;
const hostAdminChName = `${workerData.hostRoomCode}:host`;
let hostAdminCh;
const roomCode = workerData.hostRoomCode;
const hostClientId = workerData.hostClientId;
let quizRoomChannel;
let numPlayersAnswered = 0;
let customQuestions = [];
let skipTimer = false;

console.log('this is the worker thread');
console.log('room code is' + workerData.hostRoomCode);

let questions = [];

const realtime = new Ably.Realtime({
  key: ABLY_API_KEY,
  echoMessages: false
});

realtime.connection.once('connected', () => {
  hostAdminCh = realtime.channels.get(hostAdminChName);
  quizRoomChannel = realtime.channels.get(quizRoomChName);

  subscribeToHostEvents();

  quizRoomChannel.presence.subscribe('enter', handleNewPlayerEntered);
  quizRoomChannel.presence.subscribe('leave', handleExistingPlayerLeft);
  quizRoomChannel.publish('thread-ready', { start: true });
});

function handleNewPlayerEntered(player) {
  console.log(player.clientId + 'player entered quiz room');
  const newPlayerId = player.clientId;
  totalPlayers++;
  parentPort.postMessage({
    roomCode: roomCode,
    totalPlayers: totalPlayers,
    didQuizStart: didQuizStart
  });

  let newPlayerState = {
    id: newPlayerId,
    nickname: player.data.nickname,
    avatarColor: player.data.avatarColor,
    isHost: player.data.isHost,
    score: 0
  };

  if (player.data.isHost) {
    let quizType = player.data.quizType;
    quizType === 'CustomQuiz'
      ? (questions = customQuestions)
      : (questions = randomQuestions);
  } else {
    playerChannels[newPlayerId] = realtime.channels.get(
      `${roomCode}:player-ch-${player.clientId}`
    );

    subscribeToPlayerChannel(playerChannels[newPlayerId], newPlayerId);
  }

  globalPlayersState[newPlayerId] = newPlayerState;
  quizRoomChannel.publish('new-player', {
    newPlayerState
  });
}

function handleExistingPlayerLeft(player) {
  console.log('leaving player', player.clientId);
  const leavingPlayerId = player.clientId;
  totalPlayers--;
  parentPort.postMessage({
    roomCode: roomCode,
    totalPlayers: totalPlayers
  });
  delete globalPlayersState[leavingPlayerId];
  if (leavingPlayerId === hostClientId) {
    quizRoomChannel.publish('host-left', {
      endQuiz: true
    });
    forceQuizEnd();
  }
}

async function publishTimer(event, countDownSec) {
  while (countDownSec > 0) {
    quizRoomChannel.publish(event, {
      countDownSec: countDownSec
    });
    await new Promise((resolve) => setTimeout(resolve, 1000));
    countDownSec -= 1;
    if (event === 'question-timer' && skipTimer) break;
  }
}

function subscribeToHostEvents() {
  hostAdminCh.subscribe('start-quiz', async () => {
    didQuizStart = true;
    parentPort.postMessage({
      roomCode,
      didQuizStart
    });
    await publishTimer('start-quiz-timer', START_TIMER_SEC);
    publishQuestion(0, false);
  });

  hostAdminCh.subscribe('quiz-questions', (msg) => {
    for (let i = 0; i < msg.data.questions.length; i++) {
      let item = msg.data.questions[i];
      let newQuestionObject = {
        questionNumber: parseInt(item['question number']),
        showImg: item['image link'].substr(0, 4) === 'http' ? true : false,
        question: item.question,
        choices: [
          item['option 1'],
          item['option 2'],
          item['option 3'],
          item['option 4']
        ],
        correct: parseInt(item['correct answer option number']) - 1,
        pic: item['image link']
      };
      customQuestions.push(newQuestionObject);
    }
  });

  hostAdminCh.subscribe('next-question', (msg) => {
    let prevQIndex = msg.data.prevQIndex;
    let newQIndex = prevQIndex + 1;
    let lastQIndex = questions.length - 1;
    if (newQIndex < lastQIndex) {
      publishQuestion(newQIndex, false);
    } else if (newQIndex === lastQIndex) {
      publishQuestion(newQIndex, true);
    }
  });

  hostAdminCh.subscribe('end-quiz-now', () => {
    forceQuizEnd();
  });
}

function forceQuizEnd() {
  quizRoomChannel.publish('quiz-ending', {
    quizEnding: true
  });
  killWorkerThread();
}

async function publishQuestion(qIndex, isLast) {
  numPlayersAnswered = 0;
  await quizRoomChannel.publish('new-question', {
    numAnswered: 0,
    numPlaying: totalPlayers - 1,
    questionNumber: qIndex + 1,
    question: questions[qIndex].question,
    choices: questions[qIndex].choices,
    isLastQuestion: isLast,
    showImg: questions[qIndex].showImg,
    imgLink: questions[qIndex].pic
  });
  skipTimer = false;
  await publishTimer('question-timer', QUESTION_TIMER_SEC);
  await quizRoomChannel.publish('correct-answer', {
    questionNumber: qIndex + 1,
    correctAnswerIndex: questions[qIndex].correct
  });
  computeTopScorers();

  if (isLast) {
    killWorkerThread();
  }
}

function computeTopScorers() {
  let leaderboard = new Array();
  for (let item in globalPlayersState) {
    if (item != hostClientId) {
      leaderboard.push({
        nickname: globalPlayersState[item].nickname,
        score: globalPlayersState[item].score
      });
    }
  }
  leaderboard.sort((a, b) => b.score - a.score);
  quizRoomChannel.publish('full-leaderboard', {
    leaderboard: leaderboard
  });
}

function subscribeToPlayerChannel(playerChannel, playerId) {
  playerChannel.subscribe('player-answer', (msg) => {
    numPlayersAnswered++;
    if (
      questions[msg.data.questionIndex].correct === msg.data.playerAnswerIndex
    ) {
      globalPlayersState[playerId].score += 5;
    }
    updateLiveStatsForHost(numPlayersAnswered, totalPlayers - 1);
  });
  updateLiveStatsForHost(numPlayersAnswered, totalPlayers - 1);
}

function updateLiveStatsForHost(numAnswered, numPlaying) {
  quizRoomChannel.publish('live-stats-update', {
    numAnswered: numAnswered,
    numPlaying: numPlaying
  });
  if (numAnswered === numPlaying) {
    skipTimer = true;
  }
}

function killWorkerThread() {
  console.log('killing thread');
  for (const item in playerChannels) {
    if (playerChannels[item]) {
      playerChannels[item].detach();
    }
  }
  hostAdminCh.detach();
  quizRoomChannel.detach();
  parentPort.postMessage({
    killWorker: true,
    roomCode: roomCode,
    totalPlayers: totalPlayers
  });
  process.exit(0);
}
