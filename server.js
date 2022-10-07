const { Worker, isMainThread, threadId } = require('worker_threads');

const express = require('express');
const Ably = require('ably');
const envConfig = require('dotenv').config();
const serveStatic = require('serve-static');
const path = require('path');

const app = express();
const { ABLY_API_KEY } = envConfig.parsed;
const globalQuizChName = 'main-quiz-thread';

console.log(envConfig, ABLY_API_KEY);

let globalQuizChannel;
const activeQuizRooms = {};
let totalPlayersThroughout = 0;

const realtime = new Ably.Realtime({
  key: ABLY_API_KEY,
  echoMessages: false
});

app.use('/', serveStatic(path.join(__dirname, 'realtime-quiz/dist')));

app.get('/auth', (request, response) => {
  const tokenParams = { clientId: uniqueId() };
  realtime.auth.createTokenRequest(tokenParams, function (err, tokenRequest) {
    if (err) {
      response
        .status(500)
        .send('Error requesting token: ' + JSON.stringify(err));
    } else {
      response.setHeader('Content-Type', 'application/json');
      response.setHeader('Access-Control-Allow-Origin', '*');
      response.send(JSON.stringify(tokenRequest));
    }
  });
});

const uniqueId = function () {
  return 'id-' + Math.random().toString(36).substr(2, 16);
};

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, 'realtime-quiz/dist/index.html'));
});

app.get('/play', function (req, res) {
  let requestedRoomCode = req.query.quizCode;
  if (activeQuizRooms[requestedRoomCode].didQuizStart === true) {
    res.sendFile(path.join(__dirname, 'realtime-quiz/dist/index.html'));
  } else {
    res.sendFile(path.join(__dirname, 'realtime-quiz/dist/index.html'));
  }
});

app.get('/checkRoomStatus', function (req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  let requestedRoomCode = req.query.quizCode;
  res.send({
    isRoomClosed: activeQuizRooms[requestedRoomCode]
      ? activeQuizRooms[requestedRoomCode].didQuizStart
      : true
  });
});

const listener = app.listen(process.env.PORT || 8082, () => {
  console.log('Your app is listening on port ' + listener.address().port);
});

realtime.connection.once('connected', () => {
  globalQuizChannel = realtime.channels.get(globalQuizChName);
  globalQuizChannel.presence.subscribe('enter', (player) => {
    console.log('new quiz host', player.clientId);
    generateNewQuizRoom(
      player.data.nickname,
      player.data.roomCode,
      player.clientId
    );
  });
});

function generateNewQuizRoom(hostNickname, hostRoomCode, hostClientId) {
  if (isMainThread) {
    const worker = new Worker('./quiz-room-server.js', {
      workerData: {
        hostNickname: hostNickname,
        hostRoomCode: hostRoomCode,
        hostClientId: hostClientId
      }
    });
    console.log(`CREATING NEW THREAD WITH ID ${threadId}`);
    worker.on('error', (error) => {
      console.log(`WORKER EXITED DUE TO AN ERROR ${error}`);
    });
    worker.on('message', (msg) => {
      if (msg.roomCode && !msg.killWorker) {
        activeQuizRooms[msg.roomCode] = {
          roomCode: msg.roomCode,
          totalPlayers: msg.totalPlayers,
          didQuizStart: msg.didQuizStart
        };
        totalPlayersThroughout += totalPlayersThroughout;
      } else if (msg.roomCode && msg.killWorker) {
        totalPlayersThroughout -= msg.totalPlayers;
        delete activeQuizRooms[msg.roomCode];
      } else {
        activeQuizRooms[msg.roomCode].didQuizStart = msg.didQuizStart;
        console.log('Main knows started');
      }
    });

    worker.on('exit', (code) => {
      console.log(`WORKER EXITED WITH THREAD ID ${threadId}`);
      if (code !== 0) {
        console.log(`WORKER EXITED DUE TO AN ERROR WITH CODE ${code}`);
      }
    });
  }
}
