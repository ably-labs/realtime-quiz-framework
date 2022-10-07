## Documentation and understanding the code

This article is an extension of the info present in the `README.md` file and focuses on the explanation of various code snippets from this application. This article assumes that you've already read through the `README.md`.

### Creating Node JS worker threads

This kit uses [Node JS worker threads](https://nodejs.org/api/worker_threads.html) to create new quiz rooms so various people can host their quizzes independently.

To create and use Node JS worker threads, from the main thread, you'll need to require the worker_threads library:

```js
const {
  Worker,
  isMainThread,
  parentPort,
  workerData,
  threadId,
  MessageChannel
} = require('worker_threads');
```

and instance a new worker and pass it two parameters:

a) path to the worker file

b) data as a JSON object

```js
const worker = new Worker('./quiz-room-server.js', {
  workerData: {
    hostNickname: hostNickname,
    hostRoomCode: hostRoomCode,
    hostClientId: hostClientId
  }
});
```

In the worker file, you'll need to require the same library `worker_threads`. You'll have access to the `workerData` object directly.

For example, in the worker thread, you can access the host nickname with `workerData.hostNickname`.

Communication between worker and main threads
The worker thread can publish data to the main thread as follows:

```js
parentPort.postMessage({
  roomCode: roomCode,
  totalPlayers: totalPlayers,
  didQuizStart: didQuizStart
});
```

In this kit, the worker thread communicates with the main thread on four occasions:

- When a new player joins the quiz room.
- When an existing player leaves the quiz room.
- When the host has requested to start the quiz.
- When the quiz has finished and the worker thread is going to be killed.

This information is used by the main server thread to maintain a list of active worker threads, along with the number of players in each.

#### Connecting to Ably

In order to use this kit, you will need an Ably API key. If you are not already signed up, you can [sign up now for a free Ably account](https://www.ably.com/signup). Once you have an Ably account:

- Log into your app dashboard
- Under **Your apps**, click on **Manage app** for any app you wish to use for this tutorial, or create a new one with the **Create New App** button
- Click on the **API Keys** tab
- Copy the secret **API Key** value from your Root key.

The server-side scripts connect to Ably using [Basic Authentication](https://www.ably.com/documentation/core-features/authentication#basic-authentication), i.e. by using the API Key directly as shown below:

```js
const envConfig = require('dotenv').config();
const { ABLY_API_KEY } = envConfig.parsed;

const realtime = new Ably.Realtime({
  key: ABLY_API_KEY,
  echoMessages: false
});
```

Note: Setting the `echoMessages` false prevents the server from receiving its own messages.

The main server thread uses Express to listen to HTTP requests. It has an `/auth` endpoint that is used by the client-side scripts to authenticate with Ably using tokens. This is a recommended strategy as placing your secret API Key in a front-end script exposes it to potential misuse. The client-side scripts connect to Ably using [Token Authentication](https://www.ably.com/documentation/core-features/authentication#token-authentication) as shown below:

```js
const realtime = new Ably.Realtime({
  authUrl: '/auth'
});
```

#### Ably channel names used by this project

1. `main-quiz-thread` - Used by the main server thread to listen for host entries and leaves via presence. This info is used to be able to create new Node JS worker threads for new quiz rooms.

2. `<unique room code>:host` - Host channel for this quiz room. It'll be used by the host and the server to communicate host-only events.

3. `<unique room code>:primary` - Main channel for a particular quiz room. It'll be used by players to enter or leave presence on the quiz room and by the worker thread to publish and receive questions and answers.

4. `<unique room code>:player-ch-<unique client id>` - Unique channel for every player, which is used to publish their answers to the worker thread. The worker thread is subscribed to one such channel per player.

You can also add any other channels that you may need in your quiz.

> Note: Due to the fact that the above channel names exist in a unique [channel namespace](https://support.ably.com/support/solutions/articles/3000030058-what-is-a-channel-namespace-and-how-can-i-use-them-) identified by the unique room code (separated from channel names with a ':' i.e. colon), you can guarantee that one quiz room's data never creeps into the other.

## Understanding the code

Assuming you’ve seen the working of the app and understand the file structure explained in the README, let’s start by understanding the server-side code.

### Server-side code

#### 1. The `server.js` file

In this file, after requiring the necessary NPM libraries, we start with instantiating the Ably library.

```js
const realtime = new Ably.Realtime({
  key: ABLY_API_KEY,
  echoMessages: false
});
```

Ably.Realtime takes the client options JSON object as an argument and we have the Ably API Key ([Basic auth](https://www.ably.com/documentation/core-features/authentication#basic-authentication)) and `echoMessages` which when set to false prevents the client from receiving their own messages i.e if they are publishing to a channel that they are subscribed to.

Next, we set up a few routes, and have express handle them using `app.get(‘/route’, callback)`. We have the following routes:

1. `/` - this is the default route of the application, so we’ll have the server send the `index.html` file from the `dist` folder (which is a result of building our Vue project).

2. `/play` - this is the route used by players of the quiz and is helpful to differentiate players from hosts. Since we are using the `vue-router` on the front-end, which will handle routing locally, we can have our server serve the same `index.html` file from the `dist` folder as before.

3. `/auth` - this is used by the front-end clients to authenticate with ably using token authentication (unlike the server which is using basic authentication). It’s never recommended to use API Keys directly on the front-end.

4. `/checkRoomStatus` - this is the route used by the front-end app served to a player. The player app will send a request to this endpoint to check if a given quiz room still exists and is ok to take in players. The server stores information of all the available quiz rooms locally, so it can check it and respond accordingly. Based on the response, the front-end app will either allow the players to enter the room or let them know it’s not possible.

Other than serving the files and data, the `server.js` file also creates new worker threads for every new quiz room requested.

When the server has successfully established a connection with Ably, it attaches to the `main-quiz-thread` channel and subscribes to presence on that channel.

```js
globalQuizChannel = realtime.channels.get(globalQuizChName);
globalQuizChannel.presence.subscribe('enter', (player) => { }
```

We’ll see in the front end app the point at which they enter the presence set, but when the host does enter the presence set, the callback to `channel.presence.subscribe(‘enter’, callback)` will be triggered.

Our server will take this as a cue to create a new quiz room (aka NodeJS worker thread). This is done in the `generateNewQuizRoom()` method. The main thing to notice in this method is the instantiation of the worker thread:

```js
const worker = new Worker('./quiz-room-server.js', {
  workerData: {
    hostNickname: hostNickname,
    hostRoomCode: hostRoomCode,
    hostClientId: hostClientId
  }
});
```

We specify a path to the file which has the code to run in the worker thread. This can be part of the same file too but it’s just cleaner to separate them out. We then send some initial data called worker data, so the worker thread has some context and get started and working with that initial data.

In the same `generateNewQuizRoom()` method, we also set up listeners to various events such as `message`, `exit`, and `error` on this worker and handle them accordingly.

#### 2. The `quiz-room-server.js` file

This file represents the logic for an individual quiz room. It communicates with the parent thread only (i.e. `server.js`). It does not communicate or in any way share data with other worker threads.

Each quiz room is identified by a unique room code, which is generated on the front end host app before they enter the main thread. This unique code eventually comes to the `quiz-room-server.js`, so it can make use of it to attach to unique [channel namespaces](https://support.ably.com/support/solutions/articles/3000030058-what-is-a-channel-namespace-and-how-can-i-use-them-) in Ably, identified partly by its unique code.

So we’ll start by instantiating Ably for the worker thread in exactly the same way as we did before with `server.js`:

```js
const realtime = new Ably.Realtime({
  key: ABLY_API_KEY,
  echoMessages: false
});
```

Once the connection is successfully established, we’ll attach to the host channel and the quiz room channel. The host channel will be used to send and receive host-only events (aka admin level controls). The quiz room channel will be more generally used to communicate with the host and the players, in terms of the quiz questions, timers, answers, etc.

We’ll understand the `subscribeToHostEvents()` in just a bit but after calling that method, we subscribe to presence enter and leave events on the quiz room channel. We’ll use it to keep a track of the online players (and the host) along with their unique client Ids and other attributes like player score, etc.

After this is done, we’ll publish an event called `thread-ready`, so the host can start inviting other players to enter this quiz room.

```js
realtime.connection.once('connected', () => {
  hostAdminCh = realtime.channels.get(hostAdminChName);
  quizRoomChannel = realtime.channels.get(quizRoomChName);

  subscribeToHostEvents();

  quizRoomChannel.presence.subscribe('enter', handleNewPlayerEntered);

  quizRoomChannel.presence.subscribe('leave', handleExistingPlayerLeft);

  quizRoomChannel.publish('thread-ready', { start: true });
});
```

Let's now understand all the methods in this file one by one.

##### The `subscribeToHostEvents()` method

```js
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
```

We subscribe to four host-only events on the host channel:

- `start-quiz` - Published by the host when they are ready to start the quiz.
- `quiz-questions` - Published by the host with a list of questions when they’ve chosen the custom questions option.
- `next-question` - Published by the host when they’d like to show the next question.
- `end-quiz-now` - Published by the host if they’d like to end the quiz mid-way through.

##### The `handleNewPlayerEntered()` method

```js
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
```

When a new player enters, we update the `totalPlayers` count and let the parent thread (`server.js`) know. This is needed so the `server.js` can manage all the available worker threads and their states. This is also needed to allow or reject new players wanting to join a quiz room.

##### The `handleExistingPlayerLeft()` method:

```js
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
```

We’ll again update the `totalPlayers` count and let the parent thread know. We’ll also let the other players know of this by publishing a message on the `quizRoom` channel. If the leaving player was the host of the quiz, we’ll forcefully end the quiz as no one else can control the quiz.

##### The `publishTimer()` method:

```js
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
```

This is an asynchronous function, meaning, it will finish executing the `setTimeout()` function before moving onto the execution of the next statement. We use this method to publish the timer from the server, to ensure that the front-end clients are always in-sync.

There could be different kinds of timers, like the 5 sec timer before the quiz initially starts, or the 30 sec timer for every question. The two arguments for this function help determine that and act accordingly. If all the available players have answered a question, there’s no point waiting for the remaining time to elapse. In such a case, we set the `skipTimer` flag to true and skip the rest of the timer.

##### The `publishQuestion()` method:

```js
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
```

This method is pretty straightforward. It is also an async function. We start by publishing the question and its options, then the 30-sec timer, then the correct answer. We then call a method to compute the leaderboard info. If it was the last question, it means the quiz has come to an end and the worker thread is no longer needed. So we call a method to kill the thread.

##### The `forceQuizEnd()` method:

```js
function forceQuizEnd() {
  quizRoomChannel.publish('quiz-ending', {
    quizEnding: true
  });
  killWorkerThread();
}
```

This method is called when the host has requested to forcefully end the quiz midway through. In this method, we just let all the players know that the quiz has ended and kill the worker thread.

##### The `subscribeToPlayerChannel()` method:

```js
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
}
```

In this method, we subscribe to each player’s unique channel, identified partly by their unique `clientId`. When a player submits their answer to one of the questions, we save it in the state variable on our server and call a method to update the live stats for the host.

##### The `computeTopScorers()` method:

```js
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
  hostAdminCh.publish('full-leaderboard', {
    leaderboard: leaderboard
  });
}
```

In this method, we simply sort the players in terms of their latest score and publish this info to the host on the host channel.

##### The `updateLiveStatsForHost()` method:

```js
function updateLiveStatsForHost(numAnswered, numPlaying) {
  hostAdminCh.publish('live-stats-update', {
    numAnswered: numAnswered,
    numPlaying: numPlaying
  });
  if (numAnswered === numPlaying) {
    skipTimer = true;
  }
}
```

In this method, we publish the latest numbers on how many players have answered among the players who are still playing. If everyone has answered, we set the skip timer flag to true so the remaining time can be skipped.

##### The `killWorkerThread()` method:

```js
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
```

In this method we detach from all the channels, let the main thread know, and exit the process, thus killing the worker thread.

The `quiz-default-questions.js` file simply exports a set of questions to use when the host requests a random quiz.

That’s it on the server-side.

### Client-side code

The Vue app on the front-end is created using the [Vue CLI](https://cli.vuejs.org/), which conveniently sets up a standard project folder with all the files needed to get up and running quickly.

This project uses [Bootstrap](https://getbootstrap.com/) for basic styling and [Font Awesome](https://fontawesome.com/) for various icons. We have these libraries referenced in the `index.html` file. We also have a repeating background added in this file, which applies it to the whole app.

The `routes.js` file defines a routes array to be used with the [Vue Router](https://router.vuejs.org/).

The `main.js` file is the entry point to our app. It instantiates the [Vue Router](https://router.vuejs.org/) and the Vue instance and mounts the `App.vue` component.

Let’s understand the various components along with the methods in each.

**For the Host**

When the host opens the app, the `<router-vue>` in the `App.vue` file becomes the `HostHome` component.

1. `HostHome.vue`

   In this component, we show the host two options to choose the type of quiz, i.e. custom or random. We receive the Ably Realtime instance and the unique client id as props from the `App.vue` component. When one of the options is chosen, we switch to the `CreateQuizRoom.vue` component.

2. `CreateQuizRoom.vue`

   **HTML** - We show the instructions to add custom questions in case of that option being chosen. For both types of quizzes, we show an input box for the host to enter their nickname and create a quiz room with the chosen quiz type and questions if applicable.

   **JS** - This is the main file in which we attach and subscribe to various Ably channels to receive updates and publish data. Let’s understand the methods in this component:
- The `createQuizRoom()` method:

```js
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
}
```

This method is called when the host clicks on the create quiz room button. If the host chose the custom quiz option, we use the [GSheetReader library](https://www.npmjs.com/package/g-sheets-api) to fetch the questions in the required format from their Google sheet.

We then add a method to wait to hear from the game room when it’s ready, then enter the main thread to trigger the actual creation of the game room by the server.

- The `waitForGameRoom()` method:

```js
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
}
```

This method attaches to the quiz room and host channels and subscribes to the thread ready event on the quiz room. We call another method `handleQuizRoomReady()` when the callback to this is triggered.

- The `enterMainThread()` method:

```js
enterMainThread() {
  this.globalQuizCh = this.realtime.channels.get(this.globalQuizChName);
  this.globalQuizCh.presence.enter({
    nickname: this.hostNickname,
    roomCode: this.myQuizRoomCode
  });
},
```

In this method we attach to the global channel and enter the presence set on it.

- The `handleQuizRoomReady()` method:

```js
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
```

In this method, we detach from the global channel as we no longer need it and make the host enter the game room and subscribe to events. If the custom quiz option was chosen, we publish the questions extracted from their Google sheet.

- The `enterGameRoomAndSubscribeToEvents()` method:

```js
enterGameRoomAndSubscribeToEvents() {
  this.myQuizRoomCh.presence.enter({
    nickname: this.hostNickname,
    avatarColor: this.myAvatarColor,
    isHost: true,
    quizType: this.quizType
  });
  this.subscribeToHostChEvents();
  this.subscribeToRoomChEvents();
},
```

In this method, we enter presence on the quiz room channel with the initial attributes and subscribe to events on the host channel and the quiz room channel.

- The `subscribeToHostChEvents()` method:

```js
subscribeToHostChEvents() {
  this.hostAdminCh.subscribe('live-stats-update', msg => {
    this.numAnswered = msg.data.numAnswered;
    this.numPlaying = msg.data.numPlaying;
  });
  this.hostAdminCh.subscribe('full-leaderboard', msg => {
    this.leaderboard = msg.data.leaderboard;
  });
},
```

In this method, we subscribe to two host events, one for the live stats update and another for the leaderboard info. This info is shown during and after each question, respectively.

- The `subscribeToRoomChEvents()` method:

```js
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
},
```

In this method, we subscribe to a few events on the quiz room channel as described below:

`new-player` - when a new player has joined

`start-quiz-timer` - when the quiz start timer is supposed to be shown before starting the quiz

`new-question` - to get the next question to be displayed

`question-timer` - to show the synchronous timer when a question is displayed

`correct-answer` - to receive the correct answer for the latest question displayed

- The `handleNewPlayerEntered()` method:

```js
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
```

In this method, we update the online players array with the newly joined player's details.

- The `handleNewQuestionReceived()` method:

```js
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
```

In this method, we simply save the data that we receive from the server locally, to be displayed on the UI next.

- The `handleCorrectAnswerReceived()` method:

```js
handleCorrectAnswerReceived(msg) {
  this.showAnswer = true;
  if (this.newQuestionNumber == msg.data.questionNumber) {
    this.correctAnswerIndex = msg.data.correctAnswerIndex;
  }
  if (this.isLastQuestion) {
    this.showFinalScreen = true;
  }
},
```

In this method also, we save the correct answer received and show it on the screen. If the previously displayed question was the last, then we switch to the final screen that shows the leaderboard info.

- The `copyPlayerInviteLink()` method:

```js
copyPlayerInviteLink() {
  this.copyClicked = true;
  this.copyBtnText = 'Copied!';
  setTimeout(() => {
    this.copyClicked = false;
    this.copyBtnText = 'Copy shareable link';
  }, 2000);
  navigator.clipboard.writeText(this.playerLink);
},
```

A utility method to let the user copy the invite link by simply clicking a button.

- The `getRandomRoomId()` method:

```js
getRandomRoomId() {
  return (
    'room-' +
    Math.random()
      .toString(36)
      .substr(2, 8)
  );
}
```

A utility method to generate a random room code to uniquely identify the quiz room

- The `startQuiz()` and `endQuiz()` methods:

```js
startQuiz() {
  this.hostAdminCh.publish('start-quiz', {
    start: true
  });
},
endQuizNow() {
  this.showFinalScreen = true;
}
```

In these methods, we publish the start quiz event and show the final screen (which will show the leaderboard) respectively.

- `beforeDestroy()`

```js
beforeDestroy() {
  if (this.myQuizRoomCh) {
    this.myQuizRoomCh.presence.leave();
  }
  this.questionTimer = 30;
}
```

This is a component lifecycle method which is invoked just before the `CreateQuizRoom.vue` component is destroyed. In this method, we have the host leave the presence set on the quiz room channel and reset the question timer.

3. `AdminPanel.vue`

   **HTML** - We show the options to show the next question or end quiz midway through.

   **JS** - As per the button clicked, we simply publish an event on the host channel. In case the host chooses the end quiz option, we also emit an event for the `CreateQuizRoom.vue` component to be able to update the view accordingly. In this case, we show the full leaderboard.

   ```js
    showNextQuestion() {
      this.hostAdminCh.publish('next-question', {
        prevQIndex: this.prevQuestionNumber - 1
      });
    },
    endQuizNow() {
      this.hostAdminCh.publish('end-quiz-now', {
        end: true
      });
      this.$emit('end-quiz-now');
    }
   ```

4. `LiveStats.vue`

In this component we show the live stats relating to the number of players still online and among those the number of players who've already answered a particular question.

5. `Leaderboard.vue`

In this component we show the leaderboard. There are two versions of this. If the quiz is still ongoing, only the top five scorers will be shown but if the quiz has ended, a full list of people with their scores will be displayed by this component.

**For the Player**

When the player joins the quiz via the shareable link shared by their host, they'll be hitting the `/play` endpoint with some parameters. The `vue-router` that we set up will redirect all requests to the `/play` endpoint to show the `PlayerHome.vue` component. The methods in this component are similar to the ones in the `CreateQuizRoom.vue` component but are repeated to make the host and player apps look separate.

One thing to note in the `PlayerHome.vue` component's `created()` lifecycle method, is the use of the Axios library to send a request to our server:

```js
async created() {
  this.quizRoomCode = this.$route.query.quizCode;
  await axios
    .get('/checkRoomStatus?quizCode=' + this.quizRoomCode)
    .then(roomStatusInfo => {
      this.isRoomClosed = roomStatusInfo.data.isRoomClosed;
    });
  this.myQuizRoomCh = this.realtime.channels.get(
    `${this.quizRoomCode}:primary`
  );
  this.myAvatarColor =
    '#' +
    Math.random()
      .toString(16)
      .slice(-6);
},
```

This async method allows the player app to send an additional request to the server to check if the quiz room is already closed due to the quiz starting or ending or if it's ok for this player to enter. The view is be updated accordingly.

**Common components**

1. `OnlinePlayers.vue`

This component appears on the staging area for the host and players. It shows a list of online players which updates as new people join. The host can use this list to determine if they are ready to start the quiz.

2. `Question.vue`

This component displays the question, four options and optionally an image. For the host, the options are not clickable as they won't be participating in the quiz but the players will have clickable buttons for the options.

3. `Answer.vue`

This component displays the correct answer for the previously displayed question. For this host, this component will replace the options in the questions component, whereas for the players, this will be shown as a standalone component and also indicates if the option they chose was correct or not.

---

That's all the code! All the components are extensible and can be used as a starting point to customize the app as per your requirements.

If you have any questions, feel free to [give me a shout on Twitter](https://twitter.com/Srushtika) or [reach out to the support team at Ably](mailto:support@ably.com).
